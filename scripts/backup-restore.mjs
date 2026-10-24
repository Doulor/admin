#!/usr/bin/env node
// #282 一键备份的恢复脚本：读控制台「备份」页下载的 .tar.gz，核对 manifest.json 里每个文件的 sha256，
// 把 data.db 与 sites/ 还原进一个新的或空的数据目录，最后打印新环境要准备的环境变量名单。
// 只用 node: 内置模块（和 app/server/src/lib/tar-stream.ts 一样）：这是搬迁/恢复用的工具，目标机很可能
// 还没 `pnpm install`，不能依赖 app/server 的三方依赖（better-sqlite3 等）。
//
//   node scripts/backup-restore.mjs --archive <备份.tar.gz> --target <数据目录> [--force]
//
// --target 已经存在且不是空目录时拒绝执行；确认要覆盖后加 --force 重新运行（这时按归档里的路径逐个
// 写入，会覆盖同名文件，目标目录里其它不相关的文件不会被清掉）。恢复完之后把新环境的 DB_PATH 指到
// `<target>/data.db`，比赛官网目录（如果有）在 `<target>/sites`；真实密钥仍要在新环境单独配置，
// 这份归档和这个脚本都不碰密钥，只告诉你要准备哪些变量名。完整说明见 docs/ops/BACKUP.md。
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { unpackTarGz } from "../app/server/src/lib/tar-stream.ts";

export const USAGE = "用法：node scripts/backup-restore.mjs --archive <备份.tar.gz> --target <数据目录> [--force]";

export function parseArgs(argv) {
  const options = { archive: null, target: null, force: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--force") options.force = true;
    else if (arg === "--archive") options.archive = argv[(i += 1)] ?? null;
    else if (arg === "--target") options.target = argv[(i += 1)] ?? null;
    else throw new Error(`不认识的参数：${arg}（${USAGE}）`);
  }
  return options;
}

export function isNonEmptyDir(dir) {
  return existsSync(dir) && readdirSync(dir).length > 0;
}

/**
 * 把一个 tar 条目写到磁盘，边写边算 sha256；`out.write()` 返回 false（写入缓冲区满）时等 'drain' 才继续
 * 读下一块（tar-stream.ts 的 consume() 会 `await` 这个返回值），不然读得比磁盘写得快时会把整个文件攒进内存。
 */
async function writeEntry(destPath, entry) {
  mkdirSync(dirname(destPath), { recursive: true });
  const hash = createHash("sha256");
  let size = 0;
  const out = createWriteStream(destPath);
  await entry.consume(chunk => {
    hash.update(chunk);
    size += chunk.length;
    if (!out.write(chunk)) return new Promise(resolve => out.once("drain", resolve));
  });
  await new Promise((settle, fail) => out.end(error => (error ? fail(error) : settle())));
  return { sha256: hash.digest("hex"), size };
}

/**
 * 解一份归档进 `target`：第一个条目必须是 manifest.json（#282 的格式 `yzgc-system-backup@1`），
 * 之后每个文件写完立刻按 manifest 记的 sha256/size 核对，核对不过直接抛错并停止（已经写出的文件留在
 * 原地，不自动删除——留给操作的人确认目标目录后决定清不清，比脚本自己猜「要不要删」更安全）。
 * 不检查 `target` 是否为空目录：那是命令行层的确认，供应用方（测试）复用这个函数时自己决定。
 */
export async function restoreBackup({ archive, target }) {
  const targetDir = resolve(target);
  mkdirSync(targetDir, { recursive: true });
  let manifest = null;
  const restored = [];
  for await (const entry of unpackTarGz(createReadStream(archive))) {
    if (entry.path === "manifest.json") {
      const parts = [];
      await entry.consume(chunk => { parts.push(chunk); });
      manifest = JSON.parse(Buffer.concat(parts).toString("utf8"));
      if (manifest.format !== "yzgc-system-backup@1") throw new Error(`不认识的备份格式：${manifest.format}`);
      continue;
    }
    if (!manifest) throw new Error("归档里 manifest.json 不是第一个文件，这不是 #282 备份接口打出来的归档");
    const expected = manifest.files.find(file => file.path === entry.path);
    if (!expected) throw new Error(`归档里有 manifest 没记录的文件：${entry.path}`);
    const destPath = join(targetDir, entry.path);
    const written = await writeEntry(destPath, entry);
    if (written.size !== expected.size || written.sha256 !== expected.sha256) {
      throw new Error(
        `${entry.path} 校验不通过：manifest 记的是 ${expected.size} 字节 / ${expected.sha256}，` +
        `实际写出 ${written.size} 字节 / ${written.sha256}（已经写出的文件留在 ${targetDir}，确认后自行处理）`,
      );
    }
    restored.push(entry.path);
  }
  if (!manifest) throw new Error("归档是空的，没有 manifest.json");
  const missing = manifest.files.map(file => file.path).filter(path => !restored.includes(path));
  if (missing.length) throw new Error(`归档缺少 manifest 记录的文件：${missing.join(", ")}`);
  return { manifest, restored };
}

export async function main(options) {
  if (!options.archive || !options.target) throw new Error(USAGE);
  if (isNonEmptyDir(options.target) && !options.force) {
    throw new Error(`目标目录不是空的：${resolve(options.target)}。确认要覆盖后加 --force 重新运行。`);
  }
  const { manifest } = await restoreBackup({ archive: options.archive, target: options.target });
  console.log(`恢复完成：${manifest.files.length} 个文件，备份环境 ${manifest.environment}，备份时间 ${manifest.created_at}。`);
  console.log(`数据库表数：${manifest.database.tables.length}（排除的短时数据：${manifest.database.excluded_tables.join("、")}）`);
  console.log("");
  console.log("新环境要准备这些环境变量（真实值要单独配置，这份备份和这个脚本都不碰密钥）：");
  for (const name of manifest.required_env) console.log(`  ${name}`);
  console.log("");
  console.log(`把新环境的 DB_PATH 指到 ${resolve(options.target, "data.db")}；`);
  console.log(`比赛官网文件在 ${resolve(options.target, "sites")}（manifest 里没有 sites/ 开头的文件就说明这份备份没有站点包，不用建这个目录）。`);
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
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`[backup-restore] ${error.message}`);
    process.exit(1);
  }
  if (options.help) {
    console.log(USAGE);
  } else {
    main(options).catch(error => {
      console.error(`[backup-restore] 失败：${error.message}`);
      process.exit(1);
    });
  }
}
