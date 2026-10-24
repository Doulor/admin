// 第一期比赛官网（#278）的源码约束：在 sandbox CSP 下运行，所以不能引用任何外部地址；不用 emoji 与装饰字符；
// 图标都在内联的 Remix 表里；yzgc-site.json 由 site.config.ts 生成，打成包能过服务端同一套校验。
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ICONS } from "../../app/web/sites/contests/oss-2026-1/src/icons";
import { formatFactor, gradeLine, prizeTotal, trivialRule, weighted } from "../../app/web/sites/contests/oss-2026-1/src/scoring";
import { FALLBACK, SITE, manifest } from "../../app/web/sites/contests/oss-2026-1/site.config";
import { DEFAULT_GRADE_FACTORS, GRADE_KEYS, GRADE_KEY_LABELS, RUBRIC, scoringView, weightedPoints } from "../../app/server/src/lib/competition-rubric";
import { createDatabase } from "../../app/server/src/lib/db";
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
    expect(files.map(file => file.slice(ROOT.length)).sort()).toEqual(expect.arrayContaining(["index.html", "site.config.ts", "src/main.ts", "src/styles.css", "src/title.ts", "src/ticker.ts", "src/countdown.ts", "src/board.ts", "src/hero.ts", "src/scoring.ts"]));
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

  // 所有者 2026-10-24 16:57 / 16:59：首屏第一眼就要看到怎么拿分和奖多少，接口回来之前用兜底值，兜底值必须和服务端一致
  it("falls back to the server's rubric, grade factors and seeded prizes before the API answers", () => {
    expect(FALLBACK.scoring).toEqual(scoringView());
    expect(FALLBACK.grade_factors).toEqual(GRADE_KEYS.map(grade => ({ grade, label: GRADE_KEY_LABELS[grade], factor: DEFAULT_GRADE_FACTORS[grade] / 100 })));
    const { db } = createDatabase(":memory:");
    const row = db.prepare("SELECT prizes FROM competition_rules WHERE competition_id = ?").get(SITE.competition_id) as { prizes: string };
    expect(FALLBACK.prizes).toEqual(JSON.parse(row.prizes));
    db.close();
  });

  it("computes the same weighted points as the server for every cell and grade", () => {
    for (const kind of ["issue", "pr"] as const) {
      for (const [importance, row] of Object.entries(RUBRIC[kind])) {
        for (const [core, points] of Object.entries(row)) {
          for (const factor of [...Object.values(DEFAULT_GRADE_FACTORS), 50, 125, 333, 500]) {
            expect([kind, importance, core, factor, weighted(points, factor / 100)]).toEqual([kind, importance, core, factor, weightedPoints(points, factor)]);
          }
        }
      }
    }
  });

  it("writes the grade line, the anti-spam rule and the prize total in plain words", () => {
    expect(gradeLine(FALLBACK.grade_factors)).toBe("大一 ×3.5 · 大二 ×2.2 · 大三 ×1.4 · 其余 ×1.0");
    expect(gradeLine([{ grade: "year1", label: "大一", factor: 1.5 }, { grade: "year2", label: "大二", factor: 1 }])).toBe("大一 ×1.5 · 大二 ×1.0");
    expect([formatFactor(3.5), formatFactor(1), formatFactor(1.25), formatFactor(0.5)]).toEqual(["3.5", "1.0", "1.25", "0.5"]);
    expect(trivialRule(FALLBACK.scoring)).toBe("防刷：每人每周「一般 × 边缘」只算 1 条，后面的记 0 分，记录照留。");
    expect(prizeTotal(FALLBACK.prizes)).toEqual({ total: 1330, through: 8 });
  });

  it("shows the contest, how to earn points, prizes, the live board and the call to action in the first screen", () => {
    const html = read(join(ROOT, "index.html"));
    const hero = html.slice(html.indexOf('<header class="hero"'), html.indexOf("</header>\n\n    <div class=\"ticker\""));
    expect(hero).toContain("极客班第一届内部赛");
    expect(hero).toContain("组织者标「有用」才计分");
    expect(hero).toContain("按重要程度 × 核心度查表：Issue 5–30 分，MR 15–100 分，不看代码行数");
    expect(hero).toContain(gradeLine(FALLBACK.grade_factors));
    for (const text of ["第 1 名", ">700<", "第 2–3 名", ">140<", "第 4–8 名", ">70<", "前 8 名有奖，共 1,330 元", "兑奖码"]) expect(hero).toContain(text);
    expect(hero).toContain('data-slot="mini"');
    expect(hero).toContain('data-link="signup"');
    expect(html).not.toMatch(/改动不到 50 行|按改动行数/);
  });
});
