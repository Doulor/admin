#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

TARGET_DAY=""
CLEANUP=0

while [[ $# -gt 0 ]]; do
    case "$1" in
        --day)
            if [[ $# -lt 2 || "$2" =~ ^-- ]]; then
                echo "Error: --day requires a date argument (YYYY-MM-DD)" >&2
                exit 1
            fi
            TARGET_DAY="$2"
            shift 2
            ;;
        --cleanup)
            CLEANUP=1
            shift
            ;;
        -h|--help)
            echo "Usage: restore-drill.sh [--day YYYY-MM-DD] [--cleanup]"
            exit 0
            ;;
        *)
            echo "Error: Unknown argument: $1" >&2
            echo "Usage: restore-drill.sh [--day YYYY-MM-DD] [--cleanup]" >&2
            exit 1
            ;;
    esac
done

if [[ -n "${TARGET_DAY}" && ! "${TARGET_DAY}" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
    echo "Error: --day must be in YYYY-MM-DD format: ${TARGET_DAY}" >&2
    exit 1
fi

# 手动执行时若变量未设置，尝试从标准路径读取
if [[ -f /etc/gitlab-backup/env && -z "${GITLAB_BACKUP_S3_ACCESS_KEY_ID:-}" ]]; then
    set -a
    # shellcheck source=/dev/null
    . /etc/gitlab-backup/env
    set +a
fi

# 检查必需环境变量
REQUIRED_VARS=(
    GITLAB_BACKUP_S3_ACCESS_KEY_ID
    GITLAB_BACKUP_S3_SECRET_ACCESS_KEY
)
for var in "${REQUIRED_VARS[@]}"; do
    if [[ -z "${!var:-}" ]]; then
        echo "Error: Required environment variable ${var} is not set" >&2
        exit 1
    fi
done

# 读取 GPG 口令：优先从已打开的 fd 3 读取，否则从 GPG_PASSPHRASE 环境变量读取（严禁输出）
GPG_PASS=""
if { true <&3; } 2>/dev/null; then
    IFS= read -r -u 3 GPG_PASS || true
    exec 3<&-
    if [[ -z "${GPG_PASS}" ]]; then
        echo "Error: Empty passphrase on file descriptor 3" >&2
        exit 1
    fi
elif [[ -n "${GPG_PASSPHRASE:-}" ]]; then
    GPG_PASS="${GPG_PASSPHRASE}"
else
    echo "Error: Passphrase required: provide via file descriptor 3 or GPG_PASSPHRASE" >&2
    exit 1
fi

ARCHIVE_TOOL="/srv/gitlab/garage-archive.mjs"
if [[ ! -f "${ARCHIVE_TOOL}" || -L "${ARCHIVE_TOOL}" ]]; then
    echo "Error: ${ARCHIVE_TOOL} is missing or unsafe" >&2
    exit 1
fi
if [[ -n "${TARGET_DAY}" ]]; then
    RUN_JSON="$(node "${ARCHIVE_TOOL}" resolve-gitlab-run --day "${TARGET_DAY}")"
else
    RUN_JSON="$(node "${ARCHIVE_TOOL}" resolve-gitlab-run)"
fi
readarray -t RUN_FIELDS < <(node --input-type=module - "${RUN_JSON}" <<'NODE'
const value = JSON.parse(process.argv[2]);
if (!/^\d{4}-\d{2}-\d{2}$/.test(value.day ?? '') || !/^gitlab\/[A-Za-z0-9._/-]+\/$/.test(value.prefix ?? '')) process.exit(2);
console.log(value.day);
console.log(value.prefix);
NODE
)
if [[ ${#RUN_FIELDS[@]} -ne 2 ]]; then
    echo "Error: Could not resolve a valid GitLab archive run" >&2
    exit 1
fi
TARGET_DAY="${RUN_FIELDS[0]}"
REMOTE_PREFIX="${RUN_FIELDS[1]}"

STAMP="$(TZ=Asia/Shanghai date +%Y%m%dT%H%M%S)"
WORK_DIR="/srv/gitlab-drill/${STAMP}"
mkdir -p "${WORK_DIR}"/{config,data/backups,logs}

cleanup_decrypted() {
    # 清理工作目录下的所有解密明文
    if [[ -d "${WORK_DIR}" ]]; then
        rm -rf "${WORK_DIR}/extracted_config" 2>/dev/null || true
        rm -f "${WORK_DIR}/dl/"*.tar 2>/dev/null || true
        rm -f "${WORK_DIR}/data/backups/"*.tar 2>/dev/null || true
    fi
}
# 收到 INT/TERM 时退出，由 EXIT trap 统一清理；只写 trap … TERM 的话清理完脚本会接着往下跑
trap cleanup_decrypted EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# 1. 逐对象完整 GET 下载一个不可变运行，再按清单校验 SHA-256
node "${ARCHIVE_TOOL}" get-tree --role gitlab-backup --prefix "${REMOTE_PREFIX}" --destination "${WORK_DIR}/dl" >/dev/null

(
    cd "${WORK_DIR}/dl"
    sha256sum -c SHA256SUMS
)

# 2. 解密该不可变运行里的两个 .gpg 文件
BACKUP_GPG="$(find "${WORK_DIR}/dl" -maxdepth 1 -type f -name '*_gitlab_backup.tar.gpg' | sort | tail -n 1)"
CONFIG_GPG="$(find "${WORK_DIR}/dl" -maxdepth 1 -type f -name 'gitlab_config_*.tar.gpg' | sort | tail -n 1)"

if [[ -z "${BACKUP_GPG}" || ! -f "${BACKUP_GPG}" ]]; then
    echo "Error: No *_gitlab_backup.tar.gpg found in downloaded files" >&2
    exit 1
fi
if [[ -z "${CONFIG_GPG}" || ! -f "${CONFIG_GPG}" ]]; then
    echo "Error: No gitlab_config_*.tar.gpg found in downloaded files" >&2
    exit 1
fi

BACKUP_TAR_NAME="$(basename "${BACKUP_GPG}" .gpg)"
CONFIG_TAR_NAME="$(basename "${CONFIG_GPG}" .gpg)"

DECRYPTED_BACKUP="${WORK_DIR}/dl/${BACKUP_TAR_NAME}"
DECRYPTED_CONFIG="${WORK_DIR}/dl/${CONFIG_TAR_NAME}"

gpg --batch --yes --pinentry-mode loopback --passphrase-fd 3 --output "${DECRYPTED_BACKUP}" --decrypt "${BACKUP_GPG}" 3<<< "${GPG_PASS}"
gpg --batch --yes --pinentry-mode loopback --passphrase-fd 3 --output "${DECRYPTED_CONFIG}" --decrypt "${CONFIG_GPG}" 3<<< "${GPG_PASS}"

# 3. 读取现有 docker-compose.yml 中的准确镜像标签（包含 sha256 摘要）
COMPOSE_FILE="/srv/gitlab/docker-compose.yml"
if [[ ! -f "${COMPOSE_FILE}" ]]; then
    echo "Error: Compose file ${COMPOSE_FILE} does not exist" >&2
    exit 1
fi
IMAGE="$(awk '/^[[:space:]]*image:/{print $2; exit}' "${COMPOSE_FILE}")"
IMAGE="${IMAGE//[\"\']/}"
if [[ -z "${IMAGE}" ]]; then
    echo "Error: Could not extract image from ${COMPOSE_FILE}" >&2
    exit 1
fi

# 4. 解压配置归档，在容器首次启动前复制 gitlab-secrets.json
EXTRACTED_CONFIG_DIR="${WORK_DIR}/extracted_config"
mkdir -p "${EXTRACTED_CONFIG_DIR}"
tar -xf "${DECRYPTED_CONFIG}" -C "${EXTRACTED_CONFIG_DIR}"

SECRETS_SRC="${EXTRACTED_CONFIG_DIR}/srv/gitlab/config/gitlab-secrets.json"
if [[ ! -f "${SECRETS_SRC}" ]]; then
    echo "Error: gitlab-secrets.json not found in config archive" >&2
    exit 1
fi
cp "${SECRETS_SRC}" "${WORK_DIR}/config/gitlab-secrets.json"
chmod 0600 "${WORK_DIR}/config/gitlab-secrets.json"

# 配置归档解压出的明文文件使用完毕，立即删除
rm -rf "${EXTRACTED_CONFIG_DIR}"
rm -f "${DECRYPTED_CONFIG}"

# 5. 启动演练容器（若已存在则直接拒绝）
if docker inspect gitlab-drill >/dev/null 2>&1; then
    echo "Error: Container 'gitlab-drill' already exists. Remove it before running restore drill." >&2
    exit 1
fi

docker run -d \
    --name gitlab-drill \
    --hostname gitlab-drill \
    --network none \
    --memory 6g \
    --cpus 4 \
    --shm-size 256m \
    -v "${WORK_DIR}/config:/etc/gitlab" \
    -v "${WORK_DIR}/logs:/var/log/gitlab" \
    -v "${WORK_DIR}/data:/var/opt/gitlab" \
    -e GITLAB_OMNIBUS_CONFIG="external_url 'http://gitlab-drill'; prometheus_monitoring['enable'] = false; puma['worker_processes'] = 0; sidekiq['concurrency'] = 5; letsencrypt['enable'] = false" \
    "${IMAGE}"

# 6. 等待容器重配完成且核心服务启动就绪（最长 20 分钟，每 10 秒轮询）
START_TIME="$(date +%s)"
TIMEOUT=1200
UP=0

while (( $(date +%s) - START_TIME < TIMEOUT )); do
    # 不用 docker logs | grep -q：pipefail 下 grep 提前退出会让 docker logs 收到 SIGPIPE，整条管道判为失败
    if grep -q 'gitlab Reconfigured!' <<< "$(docker logs gitlab-drill 2>&1)"; then
        STATUS="$(docker exec gitlab-drill gitlab-ctl status 2>/dev/null || true)"
        if grep -qE 'run:[[:space:]]*puma:' <<< "${STATUS}" && grep -qE 'run:[[:space:]]*postgresql:' <<< "${STATUS}"; then
            UP=1
            break
        fi
    fi
    sleep 10
done

if (( UP == 0 )); then
    echo "Error: gitlab-drill failed to reconfigure and start puma/postgresql within 20 minutes" >&2
    exit 1
fi

# 7. 导入备份并执行恢复
cp "${DECRYPTED_BACKUP}" "${WORK_DIR}/data/backups/${BACKUP_TAR_NAME}"
rm -f "${DECRYPTED_BACKUP}"

docker exec gitlab-drill chown git:git "/var/opt/gitlab/backups/${BACKUP_TAR_NAME}"

docker exec gitlab-drill gitlab-ctl stop puma
docker exec gitlab-drill gitlab-ctl stop sidekiq

BACKUP_ID="${BACKUP_TAR_NAME%_gitlab_backup.tar}"
docker exec gitlab-drill gitlab-backup restore BACKUP="${BACKUP_ID}" force=yes

# 恢复完成后删除备份明文包
rm -f "${WORK_DIR}/data/backups/${BACKUP_TAR_NAME}"

# postgresql 重启常超过 runit 的等待时间而报 timeout（进程其实还在起），不以它判失败，下面按状态等就绪
docker exec gitlab-drill gitlab-ctl restart || true

# 等待 puma 重启恢复就绪（最长 10 分钟）
PUMA_UP=0
RESTART_START="$(date +%s)"
while (( $(date +%s) - RESTART_START < 600 )); do
    STATUS="$(docker exec gitlab-drill gitlab-ctl status 2>/dev/null || true)"
    if grep -qE 'run:[[:space:]]*puma:' <<< "${STATUS}" && grep -qE 'run:[[:space:]]*postgresql:' <<< "${STATUS}"; then
        PUMA_UP=1
        break
    fi
    sleep 5
done

if (( PUMA_UP == 0 )); then
    echo "Error: puma/postgresql not running 10 minutes after restart" >&2
    exit 1
fi

docker exec gitlab-drill gitlab-rake gitlab:check SANITIZE=true
docker exec gitlab-drill gitlab-rake gitlab:doctor:secrets

# 8. 打印演练实例与正式实例的对象计数对比
COUNT_RB='puts({projects: Project.count, users: User.count, issues: Issue.count}.to_json)'
DRILL_COUNTS="$(docker exec gitlab-drill gitlab-rails runner "${COUNT_RB}" | tail -n 1)"
LIVE_COUNTS="$(docker exec gitlab gitlab-rails runner "${COUNT_RB}" | tail -n 1)"
echo "drill: ${DRILL_COUNTS}"
echo "live:  ${LIVE_COUNTS}"
# 备份之后线上可能又新增了数据，计数不同只提示，不判失败
if [[ "${DRILL_COUNTS}" == "${LIVE_COUNTS}" ]]; then
    echo "COUNTS MATCH"
else
    echo "COUNTS DIFFER (live may have changed since ${TARGET_DAY})"
fi

# 10. 收尾处理：若无 --cleanup 则保留并打印清理命令；若有 --cleanup 则执行清理
if (( CLEANUP == 1 )); then
    # 路径安全防护：必须位于 /srv/gitlab-drill/ 之下且不能为根目录
    if [[ "${WORK_DIR}" =~ ^/srv/gitlab-drill/.+ && "${WORK_DIR}" != "/srv/gitlab-drill" && "${WORK_DIR}" != "/srv/gitlab-drill/" ]]; then
        docker rm -f gitlab-drill
        rm -rf "${WORK_DIR}"
        echo "Cleaned up gitlab-drill container and work directory: ${WORK_DIR}"
    else
        echo "Error: Invalid work directory guard failed: ${WORK_DIR}" >&2
        exit 1
    fi
else
    echo ""
    echo "Drill completed successfully. Container and work directory retained."
    echo "To remove, run:"
    echo "  docker rm -f gitlab-drill"
    echo "  rm -rf ${WORK_DIR}"
fi
