import { afterEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { GENERATED, applySync, planSync } from "../../scripts/hotfix-sync.mjs";

// hotfix 合进 main 之后：main 同步到镜像，再合回 stage，保证 stage >= main。
// 夹具是临时目录里的两个裸仓库（gitlab、github）加一个工作克隆，不碰 geek_main 的任何分支或远端。
const script = resolve(process.cwd(), "scripts/hotfix-sync.mjs");
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

const run = (cwd: string, ...args: string[]) => execFileSync("git", ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgSign=false", ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const NOW = new Date("2026-10-30T12:00:00+08:00");
const registry = (status = "open") => `${JSON.stringify({
  schemaVersion: 1,
  windows: [{ issue: 5, tag: "v1.2.3", status, approvedBy: "Crosery", approvedAt: "2026-10-28T19:11:00+08:00", expiresAt: "2026-11-04T19:11:00+08:00", quote: "这是一个必须走 hotfix 的 P0 问题" }],
}, null, 2)}\n`;

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "hotfix-sync-"));
  dirs.push(root);
  const gitlab = join(root, "gitlab.git");
  const github = join(root, "github.git");
  const work = join(root, "work");
  run(root, "init", "--bare", "--initial-branch=main", gitlab);
  run(root, "init", "--bare", "--initial-branch=main", github);
  mkdirSync(work);
  run(work, "init", "--initial-branch=main");
  run(work, "remote", "add", "gitlab", gitlab);
  run(work, "remote", "add", "origin", github);
  const commit = (file: string, content: string, message: string) => { mkdirSync(join(work, file, ".."), { recursive: true }); writeFileSync(join(work, file), content); run(work, "add", file); run(work, "commit", "-m", message); return run(work, "rev-parse", "HEAD"); };
  commit("base.txt", "base\n", "baseline");
  run(work, "branch", "stage");
  const pushAll = (...refs: string[]) => { for (const remote of ["gitlab", "origin"]) for (const ref of refs) run(work, "push", "--quiet", remote, `${ref}:refs/heads/${ref}`); };
  pushAll("main", "stage");
  const head = (remote: string, branch: string) => run(work, "ls-remote", remote, `refs/heads/${branch}`).split("\t")[0];
  const sync = (options: Record<string, unknown> = {}) => applySync({ repo: work, source: "gitlab", mirror: "origin", now: NOW, ...options });
  const isAncestor = (a: string, b: string) => { try { run(work, "merge-base", "--is-ancestor", a, b); return true; } catch { return false; } };
  return { work, gitlab, github, commit, pushAll, head, sync, isAncestor };
}

describe("hotfix-sync", () => {
  it("plan 只读：main 领先 stage 时列出要做的事，不改任何 ref", () => {
    const f = fixture();
    run(f.work, "checkout", "-q", "main");
    f.commit("deploy/hotfix/windows.json", registry(), "fix: 修复 (#5)");
    run(f.work, "push", "--quiet", "gitlab", "main:refs/heads/main");
    const before = [f.head("gitlab", "main"), f.head("gitlab", "stage"), f.head("origin", "main"), f.head("origin", "stage")];
    const plan = planSync({ repo: f.work, source: "gitlab", mirror: "origin" });
    expect(plan.inSync).toBe(false);
    expect(plan.steps.join("\n")).toContain("origin/main 快进");
    expect(plan.steps.join("\n")).toContain("合进 gitlab/stage");
    expect([f.head("gitlab", "main"), f.head("gitlab", "stage"), f.head("origin", "main"), f.head("origin", "stage")]).toEqual(before);
  });

  it("main 只领先 stage（线性）：镜像的 main 快进，两个远端的 stage 都推到 main", () => {
    const f = fixture();
    run(f.work, "checkout", "-q", "main");
    const fix = f.commit("deploy/hotfix/windows.json", registry(), "fix: 修复 (#5)");
    run(f.work, "push", "--quiet", "gitlab", "main:refs/heads/main");
    const result = f.sync();
    expect(result.ok, result.messages.join("\n")).toBe(true);
    for (const remote of ["gitlab", "origin"]) {
      expect(f.head(remote, "main")).toBe(fix);
      expect(f.isAncestor(fix, f.head(remote, "stage"))).toBe(true);
    }
    expect(f.head("gitlab", "stage")).toBe(f.head("origin", "stage"));
    expect(run(f.work, "worktree", "list").split("\n")).toHaveLength(1);
    expect(run(f.work, "branch", "--list", "task/*")).toBe("");
  });

  it("stage 有自己的提交：做一个合并提交，两边的提交都在；重复运行什么都不做", () => {
    const f = fixture();
    run(f.work, "checkout", "-q", "stage");
    const stageOnly = f.commit("stage.txt", "stage\n", "feat: stage 上的功能");
    f.pushAll("stage");
    run(f.work, "checkout", "-q", "main");
    const fix = f.commit("hotfix.txt", "fix\n", "fix: 修复 (#5)");
    run(f.work, "push", "--quiet", "gitlab", "main:refs/heads/main");
    const result = f.sync();
    expect(result.ok, result.messages.join("\n")).toBe(true);
    const stage = f.head("gitlab", "stage");
    expect(f.isAncestor(fix, stage)).toBe(true);
    expect(f.isAncestor(stageOnly, stage)).toBe(true);
    expect(run(f.work, "rev-list", "--parents", "-n", "1", stage).split(" ")).toHaveLength(3);
    expect(f.head("origin", "stage")).toBe(stage);
    const again = f.sync();
    expect(again.ok).toBe(true);
    expect(f.head("gitlab", "stage")).toBe(stage);
    expect(planSync({ repo: f.work, source: "gitlab", mirror: "origin" }).inSync).toBe(true);
  });

  it("冲突的不是生成物：放弃合并，什么都不推，列出冲突文件并退出码 3，不留临时 worktree 和分支", () => {
    const f = fixture();
    run(f.work, "checkout", "-q", "stage");
    f.commit("base.txt", "stage 改了\n", "feat: stage 改 base");
    f.pushAll("stage");
    run(f.work, "checkout", "-q", "main");
    f.commit("base.txt", "main 改了\n", "fix: main 改 base (#5)");
    run(f.work, "push", "--quiet", "gitlab", "main:refs/heads/main");
    const before = { gitlabMain: f.head("gitlab", "main"), gitlabStage: f.head("gitlab", "stage"), originStage: f.head("origin", "stage") };
    const result = f.sync();
    expect(result.ok).toBe(false);
    expect(result.code).toBe(3);
    expect(result.messages.join("\n")).toContain("base.txt");
    // main 的同步先于合并，冲突时已经对齐的 main 保留；stage 两边都没动
    expect(f.head("gitlab", "main")).toBe(before.gitlabMain);
    expect(f.head("origin", "main")).toBe(before.gitlabMain);
    expect(f.head("gitlab", "stage")).toBe(before.gitlabStage);
    expect(f.head("origin", "stage")).toBe(before.originStage);
    expect(run(f.work, "worktree", "list").split("\n")).toHaveLength(1);
    expect(run(f.work, "branch", "--list", "task/*")).toBe("");
  });

  it("只有生成物冲突：用生成命令重生成再提交，不是生成物的改动不受影响", () => {
    const f = fixture();
    run(f.work, "checkout", "-q", "stage");
    f.commit("generated.txt", "stage 一侧\n", "feat: stage 写生成物");
    f.pushAll("stage");
    run(f.work, "checkout", "-q", "main");
    f.commit("generated.txt", "main 一侧\n", "fix: main 写生成物 (#5)");
    f.commit("hotfix.txt", "fix\n", "fix: 修复 (#5)");
    run(f.work, "push", "--quiet", "gitlab", "main:refs/heads/main");
    // 生成命令把文件写成固定内容：模拟 docs-index 之类按整棵树重新生成
    const generated = [{ paths: ["generated.txt"], command: ["node", "-e", "require('fs').writeFileSync('generated.txt','重生成\\n')"] }];
    const result = f.sync({ generated });
    expect(result.ok, result.messages.join("\n")).toBe(true);
    const stage = f.head("gitlab", "stage");
    expect(run(f.work, "show", `${stage}:generated.txt`)).toBe("重生成");
    expect(run(f.work, "show", `${stage}:hotfix.txt`)).toBe("fix");
    expect(f.head("origin", "stage")).toBe(stage);
  });

  it("镜像的 main 和源分叉：停下，不强推，什么都不改", () => {
    const f = fixture();
    run(f.work, "checkout", "-q", "main");
    f.commit("github-only.txt", "x\n", "只在 GitHub 上的提交");
    run(f.work, "push", "--quiet", "origin", "main:refs/heads/main");
    run(f.work, "reset", "--quiet", "--hard", "HEAD~1");
    f.commit("gitlab-only.txt", "y\n", "fix: 只在 GitLab 上 (#5)");
    run(f.work, "push", "--quiet", "gitlab", "main:refs/heads/main");
    const before = [f.head("gitlab", "stage"), f.head("origin", "stage"), f.head("origin", "main")];
    const result = f.sync();
    expect(result.ok).toBe(false);
    expect(result.code).toBe(2);
    expect(result.messages.join("\n")).toContain("两边分叉");
    expect([f.head("gitlab", "stage"), f.head("origin", "stage"), f.head("origin", "main")]).toEqual(before);
  });

  it("--close-window：合并提交之后另起一个提交把窗口改 closed，stage 包含 main，main 两边快进到 stage", () => {
    const f = fixture();
    run(f.work, "checkout", "-q", "main");
    f.commit("deploy/hotfix/windows.json", registry(), "fix: 修复 (#5)");
    run(f.work, "push", "--quiet", "gitlab", "main:refs/heads/main");
    const refused = f.sync({ closeWindow: 5, evidence: "短" });
    expect(refused.ok).toBe(false);
    expect(refused.messages.join("\n")).toContain("--evidence");
    const result = f.sync({ closeWindow: 5, evidence: "合回 stage 的提交 abc1234，线上 release.json 核对通过" });
    expect(result.ok, result.messages.join("\n")).toBe(true);
    const stage = f.head("gitlab", "stage");
    for (const remote of ["gitlab", "origin"]) {
      expect(f.head(remote, "main")).toBe(stage);
      expect(f.head(remote, "stage")).toBe(stage);
    }
    const closed = JSON.parse(run(f.work, "show", `${stage}:deploy/hotfix/windows.json`)).windows[0];
    expect(closed).toMatchObject({ status: "closed", closedAt: "2026-10-30T12:00:00+08:00", evidence: "合回 stage 的提交 abc1234，线上 release.json 核对通过" });
    expect(closed.expiresAt).toBeUndefined();
    expect(run(f.work, "log", "-1", "--format=%s", stage)).toContain("关闭 hotfix 窗口 #5");
    expect(f.sync({ closeWindow: 5, evidence: "合回 stage 的提交 abc1234，线上 release.json 核对通过" }).ok).toBe(true);
    expect(f.head("gitlab", "stage")).toBe(stage);
  });

  it("只有一个远端（GitLab 流水线里的样子）：源和镜像是同一个，照样合回 stage", () => {
    const f = fixture();
    run(f.work, "remote", "remove", "origin");
    run(f.work, "checkout", "-q", "main");
    const fix = f.commit("hotfix.txt", "fix\n", "fix: 修复 (#5)");
    run(f.work, "push", "--quiet", "gitlab", "main:refs/heads/main");
    const result = applySync({ repo: f.work, source: "gitlab", mirror: "gitlab", now: NOW });
    expect(result.ok, result.messages.join("\n")).toBe(true);
    expect(f.isAncestor(fix, f.head("gitlab", "stage"))).toBe(true);
    expect(planSync({ repo: f.work, source: "gitlab", mirror: "gitlab" }).inSync).toBe(true);
  });

  it(".gitlab-ci.yml 只在 main 更新且显式开启时运行脚本，用 job token，不带别的凭据", () => {
    const text = readFileSync(resolve(process.cwd(), ".gitlab-ci.yml"), "utf8");
    expect(text).toContain('$HOTFIX_SYNC_ENABLED == "true" && $CI_PIPELINE_SOURCE == "push" && $CI_COMMIT_BRANCH == "main"');
    expect(text).toContain('GIT_DEPTH: "0"');
    expect(text).toContain("node scripts/hotfix-sync.mjs apply --source origin --mirror origin");
    expect(text).toContain("gitlab-ci-token:${CI_JOB_TOKEN}");
    expect(text).not.toMatch(/\|\| true|allow_failure|-o ci\.skip|\[skip ci\]|--force|--no-verify/);
    expect(text).not.toMatch(/glpat-|ghp_|PRIVATE-TOKEN/);
  });

  it("命令行：plan 退出 0 并打印现状；未知命令退出 2", () => {
    const f = fixture();
    const plan = execFileSync("node", [script, "plan"], { cwd: f.work, encoding: "utf8" });
    expect(plan).toContain("已同步");
    expect(() => execFileSync("node", [script, "nope"], { cwd: f.work, stdio: "pipe" })).toThrow();
    expect(existsSync(script)).toBe(true);
  });

  it("默认的生成物只有 docs/INDEX.md 与 notes/INDEX.md，且命令都存在", () => {
    expect(GENERATED.flatMap(entry => entry.paths).sort()).toEqual(["docs/INDEX.md", "notes/INDEX.md"]);
    for (const entry of GENERATED) expect(readFileSync(resolve(process.cwd(), entry.command[1]), "utf8").length).toBeGreaterThan(0);
  });
});
