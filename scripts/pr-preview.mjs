#!/usr/bin/env node
// PR 预览站（#245）的组装：把官网、控制台（、论坛）的构建产物合成一个静态站目录，
// 路径与生产 web 容器一致（官网在 /，控制台在 /admin、/console，论坛在 /forum/）。路由回落写在 netlify.toml。
// 零依赖，Netlify 构建与测试共用这一份实现。
//
//   node scripts/pr-preview.mjs assemble --web app/web/dist --console app/console/dist [--forum <dir>] --out <dir>
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** 与 Cloudflare Pages 的限制对齐（单文件 25 MiB、最多 20000 个文件），以后换托管也不用改。 */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_FILES = 20000;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function requireFile(path, what) {
  if (!existsSync(path)) throw new Error(`${what} 不存在：${path}`);
}

function merge(from, to) {
  for (const file of walk(from)) {
    const target = join(to, relative(from, file));
    if (existsSync(target)) {
      if (Buffer.compare(readFileSync(file), readFileSync(target)) !== 0) throw new Error(`两个产物里的 ${relative(to, target)} 内容不同，不能合并`);
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    cpSync(file, target);
  }
}

/**
 * @param {{ web: string, console: string, forum?: string, out: string }} dirs
 * @returns {{ files: number }}
 */
export function assemble(dirs) {
  const web = resolve(dirs.web);
  const console_ = resolve(dirs.console);
  const out = resolve(dirs.out);
  requireFile(join(web, "sites", "portal", "index.html"), "官网入口");
  requireFile(join(console_, "sites", "console", "index.html"), "控制台入口");
  if (dirs.forum) requireFile(join(resolve(dirs.forum), "200.html"), "论坛回落页 200.html");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  merge(web, out);
  merge(console_, out);
  if (dirs.forum) merge(resolve(dirs.forum), join(out, "forum"));
  const files = walk(out);
  if (files.length > MAX_FILES) throw new Error(`文件数 ${files.length} 超过 Pages 上限 ${MAX_FILES}`);
  for (const file of files) {
    const size = statSync(file).size;
    if (size > MAX_FILE_BYTES) throw new Error(`${relative(out, file)} 有 ${size} 字节，超过 Pages 单文件上限 ${MAX_FILE_BYTES}`);
  }
  return { files: files.length };
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    if (!key?.startsWith("--") || argv[i + 1] === undefined) throw new Error(`参数不对：${argv.slice(i).join(" ")}`);
    args[key.slice(2)] = argv[i + 1];
  }
  return args;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [command, ...rest] = process.argv.slice(2);
    if (command !== "assemble") throw new Error("用法：node scripts/pr-preview.mjs assemble --web <dir> --console <dir> [--forum <dir>] --out <dir>");
    const args = parseArgs(rest);
    if (!args.web || !args.console || !args.out) throw new Error("缺少 --web、--console 或 --out");
    const { files } = assemble({ web: args.web, console: args.console, forum: args.forum, out: args.out });
    console.log(`已组装 ${files} 个文件到 ${args.out}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
