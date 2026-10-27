#!/usr/bin/env bash
# 只导出当前已运行版本，不构建镜像、不停止源站、不改源数据或运行时密钥。
# 用法：prepare-arch-source.sh <全新绝对输出目录>
# 同目录必须有 export-stack-snapshot.mjs。
set -euo pipefail
umask 077
OUT=${1-}
[[ "$OUT" =~ ^/[A-Za-z0-9_./-]+$ && "$OUT" != / && "$OUT" != *..* ]] || { printf '需要安全的绝对输出目录\n' >&2; exit 1; }
[[ ! -e "$OUT" ]] || { printf '输出目录已存在，拒绝覆盖：%s\n' "$OUT" >&2; exit 1; }
HERE=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
[[ -f "$HERE/export-stack-snapshot.mjs" ]] || { printf '缺少同目录导出脚本\n' >&2; exit 1; }
mkdir -p -- "$(dirname -- "$OUT")"
# 最后一层必须原子新建；不能让 mkdir -p 接受检查后被其它导出器占用的目录。
mkdir -m 700 -- "$OUT"
HELPER_IMAGE=yzgc-preview/server:02cb751c0b83
# helper 必须含现行 prepareSystemBackup；只将它用作只读导出器，不启动应用。
docker image inspect "$HELPER_IMAGE" --format '{{.Id}}' >/dev/null
for environment in production preview; do
  if [[ "$environment" == production ]]; then tag=d4a24749d077; version=0.1.0; else tag=02cb751c0b83; version=0.1.1-rc.25@02cb751c0b83; fi
  dest="$OUT/$environment"
  mkdir -m 700 "$dest"
  refs=()
  for service in server web forum; do
    ref="yzgc-$environment/$service:$tag"
    running=$(docker inspect "yzgc-$environment-$service" --format '{{.Image}}')
    expected=$(docker image inspect "$ref" --format '{{.Id}}')
    [[ "$running" == "$expected" ]] || { printf '源容器与预期镜像不同：%s\n' "$ref" >&2; exit 1; }
    refs+=("$ref")
  done
  printf '== %s：导出已发布镜像 %s ==\n' "$environment" "$tag"
  archive="yzgc-images-$environment-$tag.tar"
  docker image save --output "$dest/$archive" "${refs[@]}"
  docker image inspect "${refs[@]}" --format '{{.RepoTags}} {{.Id}} {{.Os}}/{{.Architecture}}' | tee "$dest/images.txt"
  (cd "$dest" && sha256sum "$archive" | tee "$archive.sha256")
  printf '== %s：只读源卷的一致性快照 ==\n' "$environment"
  docker run --rm --network none --memory 256m --cpus 0.5 --user 0:0 \
    --mount "type=volume,src=yzgc-$environment-data,dst=/source,readonly" \
    --mount "type=bind,src=$HERE/export-stack-snapshot.mjs,dst=/work/export-stack-snapshot.mjs,readonly" \
    --mount "type=bind,src=$dest,dst=/output" \
    --entrypoint node "$HELPER_IMAGE" /work/export-stack-snapshot.mjs "$environment" "$version" "$tag"
  (cd "$dest" && sha256sum system-backup.tar.gz | tee system-backup.tar.gz.sha256)
done
printf 'SOURCE-PREPARED %s\n' "$OUT"
