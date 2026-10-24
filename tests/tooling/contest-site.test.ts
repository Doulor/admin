// scripts/contest-site.mjs（#278）：pack 把目录打成能过服务端校验的 zip，不合规时不写文件、退出码 1；
// check 只校验；dev 起一个带示例数据的本地预览服务，不连后端和数据库。
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync, existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkSitePackage } from "../../app/server/src/lib/site-package";

const SCRIPT = new URL("../../scripts/contest-site.mjs", import.meta.url).pathname;
const dirs: string[] = [];
const run = (...args: string[]) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });

/** 起一个 `dev` 子进程，等它打印「预览已启动」再往下走；测试结束要 `stop()`，不留下常驻进程。 */
async function startDev(args: string[]): Promise<{ port: number; stop: () => void }> {
  const port = 5600 + (process.pid % 300);
  const child = spawn(process.execPath, [SCRIPT, "dev", ...args, "--port", String(port)], { stdio: ["ignore", "pipe", "pipe"] });
  let out = "";
  await new Promise<void>((pass, fail) => {
    const onData = (chunk: Buffer) => { out += chunk.toString(); if (out.includes("预览已启动")) { child.stdout!.off("data", onData); pass(); } };
    child.stdout!.on("data", onData);
    child.on("exit", code => fail(new Error(`dev 子进程提前退出，退出码 ${code}：${out}`)));
    setTimeout(() => fail(new Error(`dev 子进程 3 秒内没打印「预览已启动」：${out}`)), 3_000);
  });
  return { port, stop: () => child.kill() };
}

function site(extra: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), "contest-site-"));
  dirs.push(root);
  const dir = join(root, "site");
  mkdirSync(join(dir, "assets"), { recursive: true });
  writeFileSync(join(dir, "index.html"), "<!doctype html><title>t</title>");
  writeFileSync(join(dir, "assets", "app.js"), "export {};");
  writeFileSync(join(dir, "yzgc-site.json"), JSON.stringify({ name: "测试", version: "1.0.0", sdk: "competition/v1", competition_id: "oss-challenge-2026-1" }));
  for (const [path, text] of Object.entries(extra)) writeFileSync(join(dir, path), text);
  return dir;
}

afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe("scripts/contest-site.mjs", () => {
  it("packs a directory into a zip the server accepts, deterministically", () => {
    const dir = site();
    const out = `${dir}-a.zip`;
    const first = run("pack", dir, "--out", out, "--competition", "oss-challenge-2026-1");
    expect(first.status, first.stderr).toBe(0);
    expect(first.stdout).toContain("通过：3 个文件");
    const zip = readFileSync(out);
    expect(checkSitePackage(zip, "oss-challenge-2026-1")).toMatchObject({ ok: true, files: expect.arrayContaining([expect.objectContaining({ path: "assets/app.js" })]) });
    expect(run("pack", dir, "--out", `${dir}-b.zip`).status).toBe(0);
    expect(readFileSync(`${dir}-b.zip`).equals(zip)).toBe(true);
    expect(run("check", out, "--competition", "oss-challenge-2026-1").status).toBe(0);
    const wrong = run("check", out, "--competition", "another");
    expect(wrong.status).toBe(1);
    expect(wrong.stderr).toContain("competition_id 是 oss-challenge-2026-1");
  });

  it("refuses hidden files and symlinks instead of skipping them, and writes nothing", () => {
    const hidden = site({ ".env": "SECRET=" });
    const out = `${hidden}.zip`;
    const refused = run("pack", hidden);
    expect(refused.status).toBe(1);
    expect(refused.stderr).toContain(".env：不能包含以 . 开头的文件或目录");
    expect(existsSync(out)).toBe(false);

    const linked = site();
    symlinkSync("/etc/hosts", join(linked, "hosts.txt"));
    const symlinked = run("pack", linked);
    expect(symlinked.status).toBe(1);
    expect(symlinked.stderr).toContain("hosts.txt：不能是符号链接");
    expect(existsSync(`${linked}.zip`)).toBe(false);
  });

  it("reports a missing manifest and bad arguments", () => {
    const dir = site();
    rmSync(join(dir, "yzgc-site.json"));
    const missing = run("pack", dir);
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain("yzgc-site.json");
    expect(run("pack").status).toBe(1);
    expect(run("unpack", dir).stderr).toContain("用法");
    const notZip = join(dirs[0], "not.zip");
    writeFileSync(notZip, "hello");
    const broken = run("check", notZip);
    expect(broken.status).toBe(1);
    expect(broken.stderr).toContain("不是 zip 文件");
  });

  it("dev：静态文件、SDK 与公开接口的示例数据一起服务，不用后端和数据库", async () => {
    const dir = site();
    const dev = await startDev([dir, "--variant", "team", "--prizes"]);
    try {
      const page = await fetch(`http://127.0.0.1:${dev.port}/`);
      expect(await page.text()).toContain("<title>t</title>");
      const sdk = await fetch(`http://127.0.0.1:${dev.port}/sdk/competition/v1.js`);
      expect(sdk.headers.get("content-type")).toContain("text/javascript");
      expect(await sdk.text()).toContain("createClient");

      const competition = await (await fetch(`http://127.0.0.1:${dev.port}/api/public/competitions/whatever-id`)).json();
      expect(competition).toMatchObject({ kind: "internal", signup: { participation: "team" } });
      expect(competition.prizes.length).toBeGreaterThan(0);
      const teams = await (await fetch(`http://127.0.0.1:${dev.port}/api/public/competitions/whatever-id/teams`)).json();
      expect(teams.enabled).toBe(true);
      expect(teams.teams.length).toBeGreaterThan(0);
      const participants = await (await fetch(`http://127.0.0.1:${dev.port}/api/public/competitions/whatever-id/participants`)).json();
      expect(participants.items.length).toBeGreaterThan(0);
      expect(participants.items.some((item: { department: unknown }) => item.department === null)).toBe(true);

      expect((await fetch(`http://127.0.0.1:${dev.port}/missing.html`)).status).toBe(404);
      // sitePathProblem 同一套判断：目录外、不在站点包扩展名白名单里的路径一律当不存在
      expect((await fetch(`http://127.0.0.1:${dev.port}/etc/passwd`)).status).toBe(404);
    } finally {
      dev.stop();
    }
  });

  it("dev：默认个人赛、不带奖励——enabled 为 false、prizes 为空", async () => {
    const dir = site();
    const dev = await startDev([dir]);
    try {
      const competition = await (await fetch(`http://127.0.0.1:${dev.port}/api/public/competitions/x`)).json();
      expect(competition.prizes).toEqual([]);
      const teams = await (await fetch(`http://127.0.0.1:${dev.port}/api/public/competitions/x/teams`)).json();
      expect(teams).toMatchObject({ enabled: false, teams: [] });
    } finally {
      dev.stop();
    }
  });
});
