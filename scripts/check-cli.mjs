#!/usr/bin/env node
// app/cli（Rust 命令行，#277）的工具链检查：cargo fmt --check && cargo clippy --all-targets -- -D warnings
// && cargo test。只在这个 task 相对 base 真的改了 app/cli 时才跑——这是独立工具链（Rust，不是 Node），
// 不能让没装 cargo 的人跑一次 pnpm check 就失败；是 task 分支但解不出 base、或者不是 task 分支（push
// stage/main、CI 的 branch-guard 检出合并提交）时，保守地当作「改了」照样跑一遍，宁可多跑不可漏跑。
//
//   node scripts/check-cli.mjs [--base origin/stage]
//
// 复用 check-doc-sync.mjs 的 resolveBase：task/* 分支默认对 origin/stage（没有就本地 stage）。
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { resolveBase } from "./check-doc-sync.mjs";

const CLI_DIR = "app/cli";

function git(root, args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

/** 从 merge-base 到工作区，app/cli 下有没有改动：已提交、没提交、未跟踪的都算。base 为 null 时保守地算「改了」。 */
function touchedCli(root, base) {
  if (!base) return true;
  const mergeBase = git(root, ["merge-base", base, "HEAD"]).trim();
  const changed = git(root, ["diff", "--name-only", mergeBase, "--", CLI_DIR]).split("\n").filter(Boolean);
  const untracked = git(root, ["ls-files", "--others", "--exclude-standard", "--", CLI_DIR]).split("\n").filter(Boolean);
  const dirty = git(root, ["status", "--porcelain", "--untracked-files=all", "--", CLI_DIR]).split("\n").filter(Boolean);
  return changed.length > 0 || untracked.length > 0 || dirty.length > 0;
}

function hasCargo() {
  try {
    execFileSync("cargo", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function run(root, args) {
  console.log(`$ (cd ${CLI_DIR} && cargo ${args.join(" ")})`);
  execFileSync("cargo", args, { cwd: resolve(root, CLI_DIR), stdio: "inherit" });
}

function main() {
  const args = process.argv.slice(2);
  let base;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--base" && args[i + 1]) base = args[++i];
    else throw new Error("用法：node scripts/check-cli.mjs [--base <ref>]");
  }
  let root;
  try {
    root = git(process.cwd(), ["rev-parse", "--show-toplevel"]).trim();
  } catch {
    throw new Error("要在 git 仓库里运行：按 Git 提交历史判断 app/cli 是否改动。");
  }
  if (!existsSync(resolve(root, CLI_DIR, "Cargo.toml"))) {
    console.log(`${CLI_DIR} 还没有 Cargo.toml，跳过。`);
    return;
  }
  const resolved = resolveBase(root, { base });
  if (resolved.note) console.warn(resolved.note);
  if (!touchedCli(root, resolved.base)) {
    console.log(`${CLI_DIR} 没有改动，跳过 cargo 检查。`);
    return;
  }
  if (!hasCargo()) {
    throw new Error(`${CLI_DIR} 有改动，但本机找不到 cargo：装 Rust 工具链后重跑（https://rustup.rs，或 \`rustup target add\` 用到的交叉编译目标见 docs/services/cli/README.md）。`);
  }
  run(root, ["fmt", "--check"]);
  run(root, ["clippy", "--all-targets", "--", "-D", "warnings"]);
  run(root, ["test"]);
  console.log(`${CLI_DIR} 通过：cargo fmt --check、cargo clippy -D warnings、cargo test。`);
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

export { touchedCli };
