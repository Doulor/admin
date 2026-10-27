#!/usr/bin/env node
// 把 app/cli 交叉编译到 5 个目标、算 sha256，产出 dist/cli/<version>/...（#277）。
// zig 和 cargo-zigbuild 是开发机工具，不进镜像、不是生产依赖：构建 app/web 镜像之前先在本机把这个脚本
// 跑完，再用 `docker build --build-context cli=dist/cli` 把 dist/cli/ 换进 Dockerfile 的 cli 阶段（见 docs/services/cli/README.md、
// docs/services/web/README.md）。dist/ 已经被 .gitignore 的 `dist` 一行覆盖（和 app/web/dist、app/console/dist
// 一样），这里的产物不进仓库。
//
//   node scripts/cli-dist.mjs                 用本机 .tools/ 构建全部 5 个目标
//   node scripts/cli-dist.mjs --container     用固定的 cargo-zigbuild 容器构建全部 5 个目标（CI/发版）
//   node scripts/cli-dist.mjs --target aarch64-apple-darwin --target x86_64-apple-darwin
//                                              只构建指定目标（调试用，别漏发布前的全量构建）
//
// 产出（dist/cli/）：
//   <version>/geek-<target>-<sha256>[.exe]      内容寻址的各目标二进制
//   <version>/geek-<target>-<sha256>[.exe].sha256
//                                               对应的 sha256（一行，`sha256sum` 兼容的格式）
//   install.sh / install.ps1                  装 `geek` 到 ~/.local/bin（Win: %USERPROFILE%\.local\bin）
//   latest.json                                { version, assets: { <target>: { file, sha256 } } }
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { constants, copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const CLI_DIR = "app/cli";
// 固定到镜像 digest，避免 tag 漂移；镜像内含 Rust、Zig、cargo-zigbuild 与 macOS SDK，供 Linux runner
// 一次交叉编译五个发布目标。它只参与构建，不进入 web 运行镜像。
export const CONTAINER_BUILDER_IMAGE =
  "ghcr.io/rust-cross/cargo-zigbuild@sha256:eb5578cfc06e070a09deb7b5852474bd128a4e561f9f123261b5ed2405e478b1";

/** 5 个发布目标：Rust target 三元组、资产名后缀、是不是 Windows（影响文件名与换行）。 */
const TARGETS = [
  { rustTarget: "aarch64-apple-darwin", windows: false },
  { rustTarget: "x86_64-apple-darwin", windows: false },
  { rustTarget: "x86_64-unknown-linux-musl", windows: false },
  { rustTarget: "aarch64-unknown-linux-musl", windows: false },
  { rustTarget: "x86_64-pc-windows-gnu", windows: true },
];

function git(root, args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function repoRoot() {
  try {
    return git(process.cwd(), ["rev-parse", "--show-toplevel"]);
  } catch {
    throw new Error("要在 git 仓库里运行：按仓库根目录定位 app/cli 与 dist/。");
  }
}

function cliVersion(root) {
  const toml = readFileSync(resolve(root, CLI_DIR, "Cargo.toml"), "utf8");
  const match = /^version\s*=\s*"([^"]+)"/m.exec(toml);
  if (!match) throw new Error(`${CLI_DIR}/Cargo.toml 里没找到 version = "..."。`);
  return match[1];
}

/** 开发机工具：zig 当 C 交叉编译器，cargo-zigbuild 驱动它；#277 的约定路径（不是生产依赖，不进镜像）。 */
function toolchainPaths(root) {
  const zigBin = resolve(root, ".tools/zig/zig-macos-aarch64-0.13.0/zig");
  const cargoZigbuild = resolve(root, ".tools/cargo/bin/cargo-zigbuild");
  for (const [label, path] of [["zig", zigBin], ["cargo-zigbuild", cargoZigbuild]]) {
    if (!existsSync(path)) {
      throw new Error(
        `找不到 ${label}（期望在 ${path}）：\n` +
        `  下载 zig 0.13.0（macOS aarch64）解到 .tools/zig/zig-macos-aarch64-0.13.0/，\n` +
        `  再 \`CARGO_INSTALL_ROOT=$(pwd)/.tools/cargo cargo install cargo-zigbuild --locked\`。\n` +
        `  两者都是开发机工具，.gitignore 已经排除 .tools/，不进仓库也不进镜像。`
      );
    }
  }
  return { zigDir: resolve(root, ".tools/zig/zig-macos-aarch64-0.13.0"), cargoZigbuildDir: resolve(root, ".tools/cargo/bin") };
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

export function legacyAssetName(rustTarget, windows = rustTarget === "x86_64-pc-windows-gnu") {
  return `geek-${rustTarget}${windows ? ".exe" : ""}`;
}

export function contentAddressedAssetName(rustTarget, sha256, windows = rustTarget === "x86_64-pc-windows-gnu") {
  return `geek-${rustTarget}-${sha256}${windows ? ".exe" : ""}`;
}

const SAFE_VERSION_RE = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?(\+[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/;
const SHA256_RE = /^[0-9a-f]{64}$/;

export function resolveManifestAsset(manifest, rustTarget) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("latest.json 必须是对象。");
  }
  if (!TARGETS.some((target) => target.rustTarget === rustTarget)) {
    throw new Error(`不认识的 target：${rustTarget}`);
  }
  const version = manifest.version;
  if (typeof version !== "string" || !SAFE_VERSION_RE.test(version)) {
    throw new Error(`latest.json 的 version 不是安全的 SemVer：${String(version ?? "缺失")}`);
  }

  const legacyFile = legacyAssetName(rustTarget);
  if (!Object.hasOwn(manifest, "assets")) {
    return { version, file: legacyFile, sha256: null, contentAddressed: false };
  }
  if (!manifest.assets || typeof manifest.assets !== "object" || Array.isArray(manifest.assets)) {
    throw new Error("latest.json 的 assets 格式不符。");
  }
  if (!Object.hasOwn(manifest.assets, rustTarget)) {
    throw new Error(`latest.json 里没有目标 ${rustTarget}。`);
  }
  const entry = manifest.assets[rustTarget];
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new Error(`latest.json 的 ${rustTarget} 条目格式不符。`);
  }
  if (typeof entry.file !== "string" || typeof entry.sha256 !== "string") {
    throw new Error(`latest.json 的 ${rustTarget} 条目缺少 file 或 sha256。`);
  }
  if (!SHA256_RE.test(entry.sha256)) {
    throw new Error(`latest.json 的 ${rustTarget} sha256 格式不符。`);
  }
  const addressedFile = contentAddressedAssetName(rustTarget, entry.sha256);
  if (entry.file !== addressedFile && entry.file !== legacyFile) {
    throw new Error(`latest.json 的文件名与目标或 sha256 不匹配：${entry.file}`);
  }
  return {
    version,
    file: entry.file,
    sha256: entry.sha256,
    contentAddressed: entry.file === addressedFile,
  };
}

function copyImmutableAsset(sourcePath, destinationPath, expectedSha256) {
  try {
    copyFileSync(sourcePath, destinationPath, constants.COPYFILE_EXCL);
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "EEXIST")) throw error;
    const existingSha256 = sha256File(destinationPath);
    if (existingSha256 !== expectedSha256) {
      throw new Error(`拒绝覆盖已存在但内容不同的内容寻址文件：${destinationPath}`);
    }
  }
}

function writeImmutableChecksum(path, contents) {
  try {
    writeFileSync(path, contents, { flag: "wx" });
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "EEXIST")) throw error;
    if (readFileSync(path, "utf8") !== contents) {
      throw new Error(`拒绝覆盖已存在但内容不同的校验文件：${path}`);
    }
  }
}

/** cargo zigbuild 需要 zig 和 cargo-zigbuild 都在 PATH 上；只在子进程的环境变量里加，不改调用者的 shell。 */
function buildTarget(root, rustTarget, env) {
  console.log(`$ (cd ${CLI_DIR} && cargo zigbuild --locked --jobs 2 --release --target ${rustTarget})`);
  execFileSync("cargo", ["zigbuild", "--locked", "--jobs", "2", "--release", "--target", rustTarget], {
    cwd: resolve(root, CLI_DIR),
    stdio: "inherit",
    env,
  });
}

/** GitHub 的 Linux runner 用固定容器完成五目标交叉编译；输出写回仓库内默认 Cargo target 目录。 */
function buildTargetsInContainer(root, targets) {
  const uid = typeof process.getuid === "function" ? String(process.getuid()) : "1000";
  const gid = typeof process.getgid === "function" ? String(process.getgid()) : "1000";
  const script = `
set -eu
mkdir -p /src/${CLI_DIR}/target
cleanup() {
  status=$?
  chown -R "$HOST_UID:$HOST_GID" /src/${CLI_DIR}/target
  exit "$status"
}
trap cleanup EXIT
for target in "$@"; do
  rustup target add "$target"
  cargo zigbuild --locked --jobs 2 --release --target "$target"
done
`;

  console.log(`$ docker run --rm --platform linux/amd64 ${CONTAINER_BUILDER_IMAGE}（${targets.length} 个目标）`);
  execFileSync("docker", [
    "run", "--rm", "--platform", "linux/amd64",
    "--volume", `${root}:/src`,
    "--workdir", `/src/${CLI_DIR}`,
    "--env", `HOST_UID=${uid}`,
    "--env", `HOST_GID=${gid}`,
    "--env", `CARGO_TARGET_DIR=/src/${CLI_DIR}/target`,
    CONTAINER_BUILDER_IMAGE,
    "sh", "-ceu", script, "cli-dist", ...targets.map((target) => target.rustTarget),
  ], { cwd: root, stdio: "inherit" });
}

function parseArgs(argv) {
  const targets = [];
  let container = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--target" && argv[i + 1]) targets.push(argv[++i]);
    else if (argv[i] === "--container") container = true;
    else throw new Error("用法：node scripts/cli-dist.mjs [--container] [--target <rust-target>]...");
  }
  return { targets, container };
}

function main() {
  const root = repoRoot();
  const { targets: wanted, container } = parseArgs(process.argv.slice(2));
  const targets = wanted.length ? TARGETS.filter((t) => wanted.includes(t.rustTarget)) : TARGETS;
  const missing = wanted.filter((t) => !TARGETS.some((known) => known.rustTarget === t));
  if (missing.length) throw new Error(`不认识的 target：${missing.join("、")}；可选：${TARGETS.map((t) => t.rustTarget).join("、")}`);

  const version = cliVersion(root);
  let env = { ...process.env };
  let targetDirectory = resolve(root, CLI_DIR, "target");
  if (container) {
    buildTargetsInContainer(root, targets);
  } else {
    const { zigDir, cargoZigbuildDir } = toolchainPaths(root);
    env = { ...env, PATH: `${cargoZigbuildDir}:${zigDir}:${env.PATH ?? ""}` };
    const metadata = JSON.parse(execFileSync("cargo", ["metadata", "--locked", "--offline", "--no-deps", "--format-version", "1"], {
      cwd: resolve(root, CLI_DIR), env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    }));
    targetDirectory = metadata.target_directory;
  }

  const outDir = resolve(root, "dist/cli", version);
  mkdirSync(outDir, { recursive: true });

  const assets = {};
  const results = [];
  for (const { rustTarget, windows } of targets) {
    const builtName = windows ? "geek.exe" : "geek";
    try {
      if (!container) buildTarget(root, rustTarget, env);
      const builtPath = resolve(targetDirectory, rustTarget, "release", builtName);
      const sha256 = sha256File(builtPath);
      const assetName = contentAddressedAssetName(rustTarget, sha256, windows);
      const outPath = resolve(outDir, assetName);
      copyImmutableAsset(builtPath, outPath, sha256);
      writeImmutableChecksum(resolve(outDir, `${assetName}.sha256`), `${sha256}  ${assetName}\n`);
      const sizeKiB = Math.round(readFileSync(outPath).length / 1024);
      assets[rustTarget] = { file: assetName, sha256 };
      results.push({ rustTarget, ok: true, sizeKiB });
      console.log(`${assetName}: ${sizeKiB} KiB, sha256 ${sha256}`);
    } catch (error) {
      results.push({ rustTarget, ok: false, error: error instanceof Error ? error.message : String(error) });
      console.error(`${legacyAssetName(rustTarget, windows)} 构建失败：${error instanceof Error ? error.message : error}`);
    }
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    throw new Error(`${failed.length}/${results.length} 个目标构建失败：${failed.map((r) => r.rustTarget).join("、")}（详情见上面的输出）。`);
  }

  writeFileSync(resolve(root, "dist/cli/latest.json"), `${JSON.stringify({ version, assets }, null, 2)}\n`);
  writeFileSync(resolve(root, "dist/cli/install.sh"), installSh());
  writeFileSync(resolve(root, "dist/cli/install.ps1"), installPs1());

  console.log(`完成：dist/cli/${version}/ 共 ${results.length} 个目标，dist/cli/{install.sh,install.ps1,latest.json} 已生成。`);
}

/** 默认源站生产，`GEEK_ORIGIN` 覆盖——和 geek 自己的源站解析（app/cli/src/config.rs）一致，预发布装机器用
 *  `curl -fsSL https://prev.yangtzeu.work/cli/install.sh | GEEK_ORIGIN=https://prev.yangtzeu.work sh`。 */
export function installSh() {
  return `#!/usr/bin/env sh
# geek 命令行安装脚本（#277）：
#   curl -fsSL https://yangtzeu.work/cli/install.sh | sh
# 预发布：
#   curl -fsSL https://prev.yangtzeu.work/cli/install.sh | GEEK_ORIGIN=https://prev.yangtzeu.work sh
set -eu

ORIGIN="\${GEEK_ORIGIN:-https://yangtzeu.work}"
INSTALL_DIR="\${GEEK_INSTALL_DIR:-\$HOME/.local/bin}"

err()  { printf '\\033[31m[geek]\\033[0m %s\\n' "\$*" >&2; }
info() { printf '\\033[36m[geek]\\033[0m %s\\n' "\$*"; }
ok()   { printf '\\033[32m[geek]\\033[0m %s\\n' "\$*"; }

os="\$(uname -s | tr '[:upper:]' '[:lower:]')"
arch="\$(uname -m)"
case "\${os}-\${arch}" in
  darwin-arm64|darwin-aarch64) target="aarch64-apple-darwin" ;;
  darwin-x86_64|darwin-amd64)  target="x86_64-apple-darwin" ;;
  linux-aarch64|linux-arm64)   target="aarch64-unknown-linux-musl" ;;
  linux-x86_64|linux-amd64)    target="x86_64-unknown-linux-musl" ;;
  *) err "不支持的平台：\${os}-\${arch}"; exit 1 ;;
esac

latest_url="\${ORIGIN}/cli/latest.json"
info "读取版本信息：\${latest_url}"
latest_json="\$(curl -fsSL "\${latest_url}")" || { err "下载 latest.json 失败：\${latest_url}"; exit 1; }
version="\$(printf '%s' "\${latest_json}" | sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/p' | head -n1)"
[ -n "\${version}" ] || { err "latest.json 里没有 version"; exit 1; }
printf '%s\\n' "\${version}" | grep -Eq '^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)(-[0-9A-Za-z]+([.-][0-9A-Za-z]+)*)?(\\+[0-9A-Za-z]+([.-][0-9A-Za-z]+)*)?$' || {
  err "latest.json 的 version 不是安全的 SemVer：\${version}"; exit 1;
}

legacy_asset="geek-\${target}"
manifest_sha=""
if printf '%s\\n' "\${latest_json}" | grep -Eq '"assets"[[:space:]]*:'; then
  entry="\$(printf '%s\\n' "\${latest_json}" | awk -v target="\${target}" '
    $0 ~ "^[[:space:]]*\\\"" target "\\\"[[:space:]]*:[[:space:]]*\\{" { inside = 1; next }
    inside && $0 ~ "^[[:space:]]*}[,]?[[:space:]]*$" { exit }
    inside { print }
  ')"
  [ -n "\${entry}" ] || { err "latest.json 里没有目标 \${target}"; exit 1; }
  asset="\$(printf '%s\\n' "\${entry}" | awk -F'"' '/^[[:space:]]*"file"[[:space:]]*:/ { print \$4; exit }')"
  manifest_sha="\$(printf '%s\\n' "\${entry}" | awk -F'"' '/^[[:space:]]*"sha256"[[:space:]]*:/ { print \$4; exit }')"
  [ -n "\${asset}" ] && [ -n "\${manifest_sha}" ] || { err "latest.json 的 \${target} 条目缺少 file 或 sha256"; exit 1; }
  printf '%s\\n' "\${manifest_sha}" | grep -Eq '^[0-9a-f]{64}$' || { err "latest.json 的 sha256 格式不符"; exit 1; }
  addressed_asset="geek-\${target}-\${manifest_sha}"
  [ "\${asset}" = "\${addressed_asset}" ] || [ "\${asset}" = "\${legacy_asset}" ] || {
    err "latest.json 的文件名与目标或 sha256 不匹配：\${asset}"; exit 1;
  }
else
  # 兼容最早只含 version 的 manifest；只能回退到这个目标的精确旧文件名。
  asset="\${legacy_asset}"
fi
asset_url="\${ORIGIN}/cli/\${version}/\${asset}"
sha_url="\${asset_url}.sha256"

tmp="\$(mktemp -d)"
trap 'rm -rf "\${tmp}"' EXIT
info "下载 \${asset}（v\${version}）：\${asset_url}"
curl -fL --retry 3 --retry-delay 2 -o "\${tmp}/geek" "\${asset_url}" || { err "下载失败：\${asset_url}"; exit 1; }

checksum_line="\$(curl -fsSL "\${sha_url}")" || { err "下载 sha256 失败：\${sha_url}"; exit 1; }
checksum_lines="\$(printf '%s\\n' "\${checksum_line}" | wc -l | tr -d '[:space:]')"
if [ "\${checksum_lines}" != "1" ] || ! printf '%s\\n' "\${checksum_line}" | grep -Eq '^[0-9a-f]{64}  [A-Za-z0-9._-]+$'; then
  err "sha256 文件格式不符"; exit 1;
fi
want="\$(printf '%s\\n' "\${checksum_line}" | awk 'NR == 1 { print \$1 }')"
checksum_file="\$(printf '%s\\n' "\${checksum_line}" | awk 'NR == 1 { print \$2 }')"
[ "\${checksum_file}" = "\${asset}" ] || { err "sha256 文件指向了别的资产：\${checksum_file}"; exit 1; }
[ -z "\${manifest_sha}" ] || [ "\${manifest_sha}" = "\${want}" ] || { err "latest.json 与 sha256 文件不一致"; exit 1; }
if command -v sha256sum >/dev/null 2>&1; then got="\$(sha256sum "\${tmp}/geek" | awk '{print \$1}')";
else got="\$(shasum -a 256 "\${tmp}/geek" | awk '{print \$1}')"; fi
[ "\${got}" = "\${want}" ] || { err "sha256 不匹配（期望 \${want}，实际 \${got}）"; exit 1; }
ok "sha256 校验通过"

chmod 0755 "\${tmp}/geek"
if ! "\${tmp}/geek" --version; then
  err "已下载的 geek 无法运行"
  exit 1
fi

mkdir -p "\${INSTALL_DIR}"
mv "\${tmp}/geek" "\${INSTALL_DIR}/geek"
ok "已安装：\${INSTALL_DIR}/geek"

case ":\${PATH}:" in
  *":\${INSTALL_DIR}:"*) ;;
  *) info "把下面这行加进 shell 配置文件才能直接用 geek："; info "  export PATH=\\"\${INSTALL_DIR}:\\\$PATH\\"" ;;
esac

ok "下一步：geek login"
`;
}

export function installPs1() {
  return `# geek 命令行安装脚本（#277，Windows）：
#   irm https://yangtzeu.work/cli/install.ps1 | iex
# 预发布：
#   $env:GEEK_ORIGIN = "https://prev.yangtzeu.work"; irm https://prev.yangtzeu.work/cli/install.ps1 | iex
$ErrorActionPreference = "Stop"

$Origin = if ($env:GEEK_ORIGIN) { $env:GEEK_ORIGIN } else { "https://yangtzeu.work" }
$InstallDir = if ($env:GEEK_INSTALL_DIR) { $env:GEEK_INSTALL_DIR } else { Join-Path $env:USERPROFILE ".local\\bin" }
$Target = "x86_64-pc-windows-gnu"

Write-Host "[geek] 读取版本信息：$Origin/cli/latest.json"
$latest = Invoke-RestMethod -Uri "$Origin/cli/latest.json"
$version = [string]$latest.version
if (-not $version) { throw "latest.json 里没有 version" }
if ($version -notmatch '^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)(-[0-9A-Za-z]+([.-][0-9A-Za-z]+)*)?(\\+[0-9A-Za-z]+([.-][0-9A-Za-z]+)*)?$') {
  throw "latest.json 的 version 不是安全的 SemVer：$version"
}

$legacyAsset = "geek-$Target.exe"
$manifestSha = $null
$assetsProperty = $latest.PSObject.Properties['assets']
if ($null -ne $assetsProperty) {
  $entryProperty = $latest.assets.PSObject.Properties[$Target]
  if ($null -eq $entryProperty) { throw "latest.json 里没有目标 $Target" }
  $entry = $entryProperty.Value
  $asset = [string]$entry.file
  $manifestSha = [string]$entry.sha256
  if (-not $asset -or -not $manifestSha) { throw "latest.json 的 $Target 条目缺少 file 或 sha256" }
  if ($manifestSha -notmatch '^[0-9a-f]{64}$') { throw "latest.json 的 sha256 格式不符" }
  $addressedAsset = "geek-$Target-$manifestSha.exe"
  if ($asset -ne $addressedAsset -and $asset -ne $legacyAsset) {
    throw "latest.json 的文件名与目标或 sha256 不匹配：$asset"
  }
} else {
  # 兼容最早只含 version 的 manifest；只能回退到这个目标的精确旧文件名。
  $asset = $legacyAsset
}
$assetUrl = "$Origin/cli/$version/$asset"
$shaUrl = "$assetUrl.sha256"

$tmpDir = Join-Path ([IO.Path]::GetTempPath()) ("geek-" + [Guid]::NewGuid().ToString("N"))
$tmp = Join-Path $tmpDir "geek.exe"
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
try {
  Write-Host "[geek] 下载 $asset（v$version）：$assetUrl"
  Invoke-WebRequest -Uri $assetUrl -OutFile $tmp

  $checksumLine = [string](Invoke-WebRequest -Uri $shaUrl).Content
  if ($checksumLine -notmatch '^([0-9a-f]{64})  ([A-Za-z0-9._-]+)\\s*$') { throw "sha256 文件格式不符" }
  $want = $Matches[1]
  $checksumFile = $Matches[2]
  if ($checksumFile -ne $asset) { throw "sha256 文件指向了别的资产：$checksumFile" }
  if ($manifestSha -and $manifestSha -ne $want) { throw "latest.json 与 sha256 文件不一致" }
  $got = (Get-FileHash -Algorithm SHA256 -Path $tmp).Hash.ToLower()
  if ($got -ne $want) { throw "sha256 不匹配（期望 $want，实际 $got）" }
  Write-Host "[geek] sha256 校验通过"

  & $tmp --version
  if ($LASTEXITCODE -ne 0) { throw "已下载的 geek 无法运行" }
  New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
  $dest = Join-Path $InstallDir "geek.exe"
  Move-Item -Force $tmp $dest
  Write-Host "[geek] 已安装：$dest"
} finally {
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $tmpDir
}

if (-not ($env:Path -split ";" | Where-Object { $_ -eq $InstallDir })) {
  Write-Host "[geek] 把下面这行加进 PowerShell 配置文件才能直接用 geek："
  Write-Host "  \$env:Path = \\"$InstallDir;\$env:Path\\""
}

Write-Host "[geek] 下一步：geek login"
`;
}

function isDirectRun() {
  if (!process.argv[1]) return false;
  try {
    return pathToFileURL(realpathSync(resolve(process.argv[1]))).href === import.meta.url;
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
