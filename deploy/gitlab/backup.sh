#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

LOCK_FILE="/run/gitlab-backup.lock"
exec 200>"${LOCK_FILE}"
if ! flock -n 200; then
    echo "Error: Another backup instance is already running (${LOCK_FILE} is locked)" >&2
    exit 1
fi

if [[ -f /etc/gitlab-backup/env && -z "${GITLAB_BACKUP_S3_ACCESS_KEY_ID:-}" ]]; then
    set -a
    # shellcheck source=/dev/null
    . /etc/gitlab-backup/env
    set +a
fi

REQUIRED_VARS=(GITLAB_BACKUP_S3_ACCESS_KEY_ID GITLAB_BACKUP_S3_SECRET_ACCESS_KEY GPG_RECIPIENT)
for var in "${REQUIRED_VARS[@]}"; do
    if [[ -z "${!var:-}" ]]; then
        echo "Error: Required environment variable ${var} is not set" >&2
        exit 1
    fi
done

ARCHIVE_TOOL="/srv/gitlab/garage-archive.mjs"
if [[ ! -f "${ARCHIVE_TOOL}" || -L "${ARCHIVE_TOOL}" ]]; then
    echo "Error: ${ARCHIVE_TOOL} is missing or unsafe" >&2
    exit 1
fi
export HOME="${HOME:-/root}"
if ! gpg --batch --list-keys "${GPG_RECIPIENT}" >/dev/null 2>&1; then
    echo "Error: GPG public key ${GPG_RECIPIENT} not found in keyring" >&2
    exit 1
fi
if [[ "$(docker inspect -f '{{.State.Running}}' gitlab 2>/dev/null || true)" != "true" ]]; then
    echo "Error: Container 'gitlab' is not running" >&2
    exit 1
fi

DAY=$(TZ=Asia/Shanghai date +%F)
STAMP=$(TZ=Asia/Shanghai date +%Y%m%dT%H%M%S)
DAY_DIR="/srv/gitlab/backups-enc/${DAY}"
STAGE_DIR="${DAY_DIR}/${STAMP}"
CONFIG_TAR="${STAGE_DIR}/gitlab_config_${STAMP}.tar"
MARKER_FILE="/srv/gitlab/data/backups/.backup_marker_${STAMP}"

cleanup() {
    [[ -n "${CONFIG_TAR:-}" && -f "${CONFIG_TAR}" ]] && rm -f "${CONFIG_TAR}"
    [[ -n "${MARKER_FILE:-}" && -f "${MARKER_FILE}" ]] && rm -f "${MARKER_FILE}"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

mkdir -p /srv/gitlab/data/backups "${DAY_DIR}"
mkdir -m 0700 "${STAGE_DIR}"
touch "${MARKER_FILE}"
docker exec gitlab gitlab-backup create SKIP=registry STRATEGY=copy CRON=1

BACKUP_TAR=""
if [[ -d /srv/gitlab/data/backups ]]; then
    BACKUP_TAR="$(find /srv/gitlab/data/backups -maxdepth 1 -type f -name '*_gitlab_backup.tar' -newer "${MARKER_FILE}" -printf '%T@\t%p\n' 2>/dev/null | sort -n | tail -n 1 | cut -f2-)"
fi
rm -f "${MARKER_FILE}"
if [[ -z "${BACKUP_TAR}" || ! -f "${BACKUP_TAR}" || -L "${BACKUP_TAR}" ]]; then
    echo "Error: No newly created regular GitLab backup tar found" >&2
    exit 1
fi

CONFIG_CANDIDATE_PATHS=(
    srv/gitlab/config srv/gitlab/docker-compose.yml srv/gitlab/backup.sh srv/gitlab/restore-drill.sh srv/gitlab/garage-archive.mjs
    etc/systemd/system/gitlab-backup.service etc/systemd/system/gitlab-backup.timer etc/systemd/system/gitlab-compose.service
)
CONFIG_PATHS=()
for rel_path in "${CONFIG_CANDIDATE_PATHS[@]}"; do
    [[ -e "/${rel_path}" ]] && CONFIG_PATHS+=("${rel_path}")
done
if [[ ${#CONFIG_PATHS[@]} -eq 0 ]]; then
    echo "Error: None of the target configuration paths exist to archive" >&2
    exit 1
fi
tar -C / -cf "${CONFIG_TAR}" "${CONFIG_PATHS[@]}"

ENC_BACKUP="${STAGE_DIR}/$(basename "${BACKUP_TAR}").gpg"
ENC_CONFIG="${CONFIG_TAR}.gpg"
gpg --batch --yes --trust-model always --recipient "${GPG_RECIPIENT}" --output "${ENC_BACKUP}" --encrypt "${BACKUP_TAR}"
gpg --batch --yes --trust-model always --recipient "${GPG_RECIPIENT}" --output "${ENC_CONFIG}" --encrypt "${CONFIG_TAR}"
rm -f "${CONFIG_TAR}"
(
    cd "${STAGE_DIR}"
    sha256sum -- *.gpg > SHA256SUMS
)
chmod 0600 "${STAGE_DIR}"/*

node "${ARCHIVE_TOOL}" put-tree --role gitlab-backup --source "${STAGE_DIR}" --prefix "gitlab/${DAY}/${STAMP}/" >/dev/null
echo "OK gitlab/${DAY}/${STAMP}/ $(find "${STAGE_DIR}" -maxdepth 1 -type f | wc -l | tr -d ' ') files"
