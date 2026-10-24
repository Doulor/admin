#!/usr/bin/env node
// 把 app/cli 交叉编译到 5 个目标、算 sha256，产出 dist/cli/<version>/...（#277）。
// zig 和 cargo-zigbuild 是开发机工具，不进镜像、不是生产依赖：构建 app/web 镜像之前先在本机把这个脚本
// 跑完，再用 `docker build --build-context cli=dist/cli` 把 dist/cli/ 换进 Dockerfile 的 cli 阶段（见 docs/services/cli/README.md、
// docs/services/web/README.md）。dist/ 已经被 .gitignore 的 `dist` 一行覆盖（和 app/web/dist、app/console/dist
// 一样），这里的产物不进仓库。
//
//   node scripts/cli-dist.mjs                 构建全部 5 个目标
//   node scripts/cli-dist.mjs --target aarch64-apple-darwin --target x86_64-apple-darwin
//                                              只构建指定目标（调试用，别漏发布前的全量构建）
//
// 产出（dist/cli/）：
//   <version>/geek-<target>[.exe]             各目标的二进制
//   <version>/geek-<target>[.exe].sha256       对应的 sha256（一行，`sha256sum` 兼容的格式）
//   install.sh / install.ps1                  装 `geek` 到 ~/.local/bin（Win: %USERPROFILE%\.local\bin）
//   latest.json                                { version, assets: { <target>: { file, sha256 } } }
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const CLI_DIR = "app/cli";

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

/** cargo zigbuild 需要 zig 和 cargo-zigbuild 都在 PATH 上；只在子进程的环境变量里加，不改调用者的 shell。 */
function buildTarget(root, rustTarget, env) {
  console.log(`$ (cd ${CLI_DIR} && cargo zigbuild --release --target ${rustTarget})`);
  execFileSync("cargo", ["zigbuild", "--release", "--target", rustTarget], {
    cwd: resolve(root, CLI_DIR),
    stdio: "inherit",
    env,
  });
}

function parseArgs(argv) {
  const targets = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--target" && argv[i + 1]) targets.push(argv[++i]);
    else throw new Error("用法：node scripts/cli-dist.mjs [--target <rust-target>]...");
  }
  return targets;
}

function main() {
  const root = repoRoot();
  const wanted = parseArgs(process.argv.slice(2));
  const targets = wanted.length ? TARGETS.filter((t) => wanted.includes(t.rustTarget)) : TARGETS;
  const missing = wanted.filter((t) => !TARGETS.some((known) => known.rustTarget === t));
  if (missing.length) throw new Error(`不认识的 target：${missing.join("、")}；可选：${TARGETS.map((t) => t.rustTarget).join("、")}`);

  const version = cliVersion(root);
  const { zigDir, cargoZigbuildDir } = toolchainPaths(root);
  const env = { ...process.env, PATH: `${cargoZigbuildDir}:${zigDir}:${process.env.PATH ?? ""}` };

  const outDir = resolve(root, "dist/cli", version);
  mkdirSync(outDir, { recursive: true });

  const assets = {};
  const results = [];
  for (const { rustTarget, windows } of targets) {
    const assetName = `geek-${rustTarget}${windows ? ".exe" : ""}`;
    try {
      buildTarget(root, rustTarget, env);
      const builtPath = resolve(root, CLI_DIR, "target", rustTarget, "release", windows ? "geek.exe" : "geek");
      const outPath = resolve(outDir, assetName);
      copyFileSync(builtPath, outPath);
      const sha256 = sha256File(outPath);
      writeFileSync(resolve(outDir, `${assetName}.sha256`), `${sha256}  ${assetName}\n`);
      const sizeKiB = Math.round(readFileSync(outPath).length / 1024);
      assets[rustTarget] = { file: assetName, sha256 };
      results.push({ rustTarget, ok: true, sizeKiB });
      console.log(`${assetName}: ${sizeKiB} KiB, sha256 ${sha256}`);
    } catch (error) {
      results.push({ rustTarget, ok: false, error: error instanceof Error ? error.message : String(error) });
      console.error(`${assetName} 构建失败：${error instanceof Error ? error.message : error}`);
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
function installSh() {
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

asset="geek-\${target}"
asset_url="\${ORIGIN}/cli/\${version}/\${asset}"
sha_url="\${asset_url}.sha256"

tmp="\$(mktemp -d)"
trap 'rm -rf "\${tmp}"' EXIT
info "下载 \${asset}（v\${version}）：\${asset_url}"
curl -fL --retry 3 --retry-delay 2 -o "\${tmp}/geek" "\${asset_url}" || { err "下载失败：\${asset_url}"; exit 1; }

want="\$(curl -fsSL "\${sha_url}" | awk '{print \$1}')" || { err "下载 sha256 失败：\${sha_url}"; exit 1; }
if command -v sha256sum >/dev/null 2>&1; then got="\$(sha256sum "\${tmp}/geek" | awk '{print \$1}')";
else got="\$(shasum -a 256 "\${tmp}/geek" | awk '{print \$1}')"; fi
[ "\${got}" = "\${want}" ] || { err "sha256 不匹配（期望 \${want}，实际 \${got}）"; exit 1; }
ok "sha256 校验通过"

mkdir -p "\${INSTALL_DIR}"
mv "\${tmp}/geek" "\${INSTALL_DIR}/geek"
chmod 0755 "\${INSTALL_DIR}/geek"
ok "已安装：\${INSTALL_DIR}/geek"

case ":\${PATH}:" in
  *":\${INSTALL_DIR}:"*) ;;
  *) info "把下面这行加进 shell 配置文件才能直接用 geek："; info "  export PATH=\\"\${INSTALL_DIR}:\\\$PATH\\"" ;;
esac

"\${INSTALL_DIR}/geek" --version 2>/dev/null && ok "下一步：geek login" || true
`;
}

function installPs1() {
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
$version = $latest.version
if (-not $version) { throw "latest.json 里没有 version" }

$asset = "geek-$Target.exe"
$assetUrl = "$Origin/cli/$version/$asset"
$shaUrl = "$assetUrl.sha256"

$tmp = New-TemporaryFile
Write-Host "[geek] 下载 $asset（v$version）：$assetUrl"
Invoke-WebRequest -Uri $assetUrl -OutFile $tmp

$want = (Invoke-RestMethod -Uri $shaUrl).Split(" ")[0].Trim()
$got = (Get-FileHash -Algorithm SHA256 -Path $tmp).Hash.ToLower()
if ($got -ne $want) { throw "sha256 不匹配（期望 $want，实际 $got）" }
Write-Host "[geek] sha256 校验通过"

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
$dest = Join-Path $InstallDir "geek.exe"
Move-Item -Force $tmp $dest
Write-Host "[geek] 已安装：$dest"

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
