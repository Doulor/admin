// 第一期比赛官网（#278）的源码约束：在 sandbox CSP 下运行，所以不能引用任何外部地址；不用 emoji 与装饰字符；
// 图标都在内联的 Remix 表里；yzgc-site.json 由 site.config.ts 生成，打成包能过服务端同一套校验。
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ICONS } from "../../app/web/sites/contests/oss-2026-1/src/icons";
import { SITE, manifest } from "../../app/web/sites/contests/oss-2026-1/site.config";
import { checkSitePackage, writeZip } from "../../app/server/src/lib/site-package";

const ROOT = new URL("../../app/web/sites/contests/oss-2026-1/", import.meta.url).pathname;
const sources = (dir: string): string[] => readdirSync(dir).flatMap(name => {
  if (name === "dist" || name === "public") return [];
  const path = join(dir, name);
  return statSync(path).isDirectory() ? sources(path) : /\.(?:ts|css|html)$/.test(name) ? [path] : [];
});
const files = sources(ROOT);
const read = (path: string) => readFileSync(path, "utf8");
const withoutComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'])\/\/.*$/gm, "$1").replace(/<!--[\s\S]*?-->/g, "");

describe("contest site oss-2026-1", () => {
  it("has its source files", () => {
    expect(files.map(file => file.slice(ROOT.length)).sort()).toEqual(expect.arrayContaining(["index.html", "site.config.ts", "src/main.ts", "src/styles.css", "src/title.ts", "src/ticker.ts", "src/countdown.ts", "src/board.ts"]));
  });

  it("never references another origin: the sandbox CSP only allows 'self'", () => {
    for (const file of files) {
      if (file.endsWith("vite.config.ts")) continue; // 开发代理只在本机
      const code = withoutComments(read(file));
      expect([file, code.match(/(?:https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}[^\s"'`)]*/gi)]).toEqual([file, null]);
      expect([file, /@import|url\(\s*["']?https?:/i.test(code)]).toEqual([file, false]);
    }
  });

  it("uses no emoji or decorative characters in the interface", () => {
    const banned = /[\u{1F000}-\u{1FFFF}☀-➿⬀-⯿️←-⇿■-◿♥♡✧♪]/u;
    for (const file of files) expect([file, banned.test(withoutComments(read(file)))]).toEqual([file, false]);
  });

  it("only uses Remix icons that are inlined", () => {
    const used = new Set<string>();
    for (const file of files) {
      for (const match of read(file).matchAll(/data-icon="([a-z0-9-]+)"/g)) used.add(match[1]);
      for (const match of read(file).matchAll(/iconSvg\("([a-z0-9-]+)"/g)) used.add(match[1]);
    }
    expect(used.size).toBeGreaterThan(10);
    for (const name of used) expect(Object.keys(ICONS)).toContain(name);
  });

  it("generates a manifest that the server accepts for the first competition", () => {
    const data = manifest();
    expect(data).toMatchObject({ sdk: "competition/v1", competition_id: "oss-challenge-2026-1" });
    // 兜底时间：2026-10-21 00:00 到 11-15 23:59:59（北京时间）
    expect(new Date(SITE.fallback.start_at).toISOString()).toBe("2026-10-20T16:00:00.000Z");
    expect(new Date(SITE.fallback.end_at).toISOString()).toBe("2026-11-15T15:59:59.000Z");
    const zip = writeZip([
      { path: "index.html", data: Buffer.from(read(join(ROOT, "index.html"))) },
      { path: "yzgc-site.json", data: Buffer.from(JSON.stringify(data)) },
      { path: "assets/styles.css", data: readFileSync(join(ROOT, "src/styles.css")) },
    ]);
    expect(checkSitePackage(zip, "oss-challenge-2026-1")).toMatchObject({ ok: true, report: [] });
    expect(checkSitePackage(zip, "another").ok).toBe(false);
  });

  it("refreshes within the owner's window and points at the GitLab repository", () => {
    expect(SITE.refreshMs).toBeGreaterThanOrEqual(5_000);
    expect(SITE.refreshMs).toBeLessThanOrEqual(15_000);
    expect(SITE.repository).toBe("geek/admin");
  });
});
