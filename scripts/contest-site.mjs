#!/usr/bin/env node
// 比赛官网站点包（#278，CONTRACT-278 §1）的本地打包与校验。规则只在 app/server/src/lib/site-package.ts，
// 服务端上传接口用的是同一份，所以本地通过的包，上传时也会通过。
//
//   node scripts/contest-site.mjs pack <构建产物目录> [--out <文件.zip>] [--competition <比赛 id>]
//        把目录里的文件按路径排序打成 zip（UTF-8 文件名、固定时间戳，同样的输入得到同样的 zip），
//        打完立刻跑一遍校验；不通过时逐条列出原因、不写文件、退出码 1。默认写到 <目录>.zip。
//   node scripts/contest-site.mjs check <文件.zip> [--competition <比赛 id>]
//        只校验。--competition 给了时，yzgc-site.json 里的 competition_id 必须等于它。
//
// 目录里的符号链接、以 . 开头的文件都算不通过，不会被悄悄跳过。需要 Node 22.18 以上（直接加载 .ts）。
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { checkSitePackage, writeZip } from "../app/server/src/lib/site-package.ts";

const USAGE = "用法：node scripts/contest-site.mjs pack <目录> [--out <文件.zip>] [--competition <比赛 id>]\n      node scripts/contest-site.mjs check <文件.zip> [--competition <比赛 id>]";

/** 收集目录下的全部文件；符号链接不跟进去，记成一条问题（和服务端的校验同一句话）。 */
export function collectFiles(root) {
  const files = [];
  const problems = [];
  const walk = (dir, prefix) => {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name);
      const rel = prefix ? `${prefix}/${name}` : name;
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) problems.push(`${rel}：不能是符号链接`);
      else if (stat.isDirectory()) walk(path, rel);
      else if (stat.isFile()) files.push({ path: rel, data: readFileSync(path) });
      else problems.push(`${rel}：不是普通文件`);
    }
  };
  walk(root, "");
  return { files, problems };
}

/** 打包并校验；返回 { zip, check }。有符号链接时不打包，check 里只有这些问题。 */
export function packDirectory(root, competitionId = null) {
  const { files, problems } = collectFiles(root);
  if (problems.length) return { zip: null, check: { ok: false, report: problems, sha256: "", size: 0, files: [], manifest: null, totalBytes: 0 } };
  const zip = writeZip(files);
  return { zip, check: checkSitePackage(zip, competitionId) };
}

function parse(argv) {
  const [command, target, ...rest] = argv;
  const options = { out: null, competition: null };
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--out") options.out = rest[++i] ?? null;
    else if (rest[i] === "--competition") options.competition = rest[++i] ?? null;
    else throw new Error(`不认识的参数：${rest[i]}\n${USAGE}`);
  }
  if (!["pack", "check"].includes(command) || !target) throw new Error(USAGE);
  return { command, target, ...options };
}

function report(check) {
  if (check.ok) {
    console.log(`通过：${check.files.length} 个文件，解压后 ${check.totalBytes} 字节，zip ${check.size} 字节`);
    console.log(`sha256 ${check.sha256}`);
    if (check.manifest) console.log(`yzgc-site.json：${check.manifest.name} ${check.manifest.version}（sdk ${check.manifest.sdk}${check.manifest.competition_id ? `，比赛 ${check.manifest.competition_id}` : ""}）`);
  } else {
    console.error(`没通过，共 ${check.report.length} 条：`);
    for (const line of check.report) console.error(`  - ${line}`);
  }
}

export function main(argv = process.argv.slice(2)) {
  const { command, target, out, competition } = parse(argv);
  const path = resolve(target);
  if (command === "pack") {
    if (!existsSync(path) || !statSync(path).isDirectory()) throw new Error(`${target} 不是目录`);
    const { zip, check } = packDirectory(path, competition);
    report(check);
    if (!check.ok) return 1;
    const file = resolve(out ?? `${path.replace(/\/+$/, "")}.zip`);
    writeFileSync(file, zip);
    console.log(`已写入 ${file}`);
    return 0;
  }
  if (!existsSync(path) || !statSync(path).isFile()) throw new Error(`${target} 不是文件`);
  const check = checkSitePackage(readFileSync(path), competition);
  report(check);
  return check.ok ? 0 : 1;
}

// 取 realpath：经符号链接的路径运行时 argv 与 import.meta.url 不同
if (process.argv[1] && pathToFileURL(realpathSync(resolve(process.argv[1]))).href === import.meta.url) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
