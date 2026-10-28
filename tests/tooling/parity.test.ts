import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LEDGER_FILE, SMOKE_FILE, addEntry, beijingNow, gateReport, nextId, pendingEntries, runCompare, runRequire, shapeDiff, shapeOf, updateEntry, validateLedger,
} from "../../scripts/parity.mjs";

const readJson = (path: string) => JSON.parse(readFileSync(resolve(process.cwd(), path), "utf8"));
const base = () => ({
  schemaVersion: 1,
  entries: [{
    id: "P-0001", surface: "data", issue: 1, title: "示例数据迁移",
    preview: { doneAt: "2026-10-28", evidence: "预发布做过并验证" },
    production: { status: "pending", action: "正式执行同一个迁移脚本" },
  }],
});
const input = { surface: "env", title: "新增一个密钥", issue: 2, previewEvidence: "预发布已配置并验证", productionAction: "正式环境同名配置" };

describe("同构清单", () => {
  it("仓库里的清单格式正确，不写任何环境域名", () => {
    expect(validateLedger(readJson(LEDGER_FILE))).toEqual([]);
    expect(readFileSync(resolve(process.cwd(), LEDGER_FILE), "utf8")).not.toMatch(/(?<![\w.-])(prev\.)?yangtzeu\.work/);
    expect(readFileSync(resolve(process.cwd(), SMOKE_FILE), "utf8")).not.toMatch(/(?<![\w.-])(prev\.)?yangtzeu\.work/);
  });

  it("登记时自动编号，状态是 pending，北京时间取自时钟", () => {
    const { ledger, entry } = addEntry(base(), { ...input, now: "2026-10-28T20:00:00+08:00" });
    expect(entry).toMatchObject({ id: "P-0002", production: { status: "pending" }, preview: { doneAt: "2026-10-28T20:00:00+08:00" } });
    expect(nextId(ledger)).toBe("P-0003");
    expect(beijingNow(new Date("2026-10-28T12:00:00Z"))).toBe("2026-10-28T20:00:00+08:00");
  });

  it("缺字段、非法 surface 登记失败", () => {
    expect(() => addEntry(base(), { ...input, surface: "code" })).toThrow(/surface/);
    expect(() => addEntry(base(), { ...input, productionAction: "短" })).toThrow(/production.action/);
    expect(() => addEntry(base(), { ...input, issue: 0 })).toThrow(/issue/);
  });

  it("pending 能推进到 done / not_applicable / waived，推进后不能再改", () => {
    const done = updateEntry(base(), "P-0001", { status: "done", doneAt: "2026-10-28", evidence: "正式执行并验证通过" });
    expect(pendingEntries(done)).toEqual([]);
    expect(() => updateEntry(done, "P-0001", { status: "pending" })).toThrow(/已经是 done/);
    expect(pendingEntries(updateEntry(base(), "P-0001", { status: "not_applicable", reason: "正式库没有这张表，不需要迁移" }))).toEqual([]);
    expect(() => updateEntry(base(), "P-0001", { status: "not_applicable", reason: "" })).toThrow(/理由/);
    expect(() => updateEntry(base(), "P-0001", { status: "done", evidence: "正式执行并验证通过" })).toThrow(/doneAt/);
    expect(() => updateEntry(base(), "P-9999", { status: "done" })).toThrow(/没有这条/);
  });

  it("豁免只认所有者的署名和原话", () => {
    expect(() => updateEntry(base(), "P-0001", { status: "waived", waiver: { by: "agent", at: "2026-10-28", quote: "先上线" } })).toThrow(/所有者/);
    expect(() => updateEntry(base(), "P-0001", { status: "waived", waiver: { by: "Crosery", at: "2026-10-28", quote: "" } })).toThrow(/所有者/);
    const waived = updateEntry(base(), "P-0001", { status: "waived", waiver: { by: "Crosery", at: "2026-10-28", quote: "这条先不做，下个版本补" } });
    expect(pendingEntries(waived)).toEqual([]);
  });

  it("发版前核对：仓库当前还有 pending，会拦住发版", () => {
    expect(pendingEntries(readJson(LEDGER_FILE)).length).toBeGreaterThan(0);
  });

  it("phase 缺省按部署前算，post_deploy 的条目不拦发版但要被收尾核对看到", () => {
    const { ledger } = addEntry(base(), { ...input, phase: "post_deploy" });
    expect(pendingEntries(ledger, { phase: "pre_deploy" }).map(e => e.id)).toEqual(["P-0001"]);
    expect(pendingEntries(ledger, { phase: "post_deploy" }).map(e => e.id)).toEqual(["P-0002"]);
    expect(pendingEntries(ledger).map(e => e.id)).toEqual(["P-0001", "P-0002"]);
    expect(() => addEntry(base(), { ...input, phase: "later" })).toThrow(/phase/);
  });

  it("release 只拦部署前的条目，complete 要求全部清零，缺省只校验格式", () => {
    const afterOnly = addEntry(updateEntry(base(), "P-0001", { status: "done", doneAt: "2026-10-28", evidence: "正式执行并验证通过" }), { ...input, phase: "post_deploy" }).ledger;
    expect(gateReport(afterOnly, "release")).toMatchObject({ blocking: [], after: [{ id: "P-0002" }] });
    expect(gateReport(afterOnly, "complete").blocking.map(e => e.id)).toEqual(["P-0002"]);
    expect(gateReport(base(), "release").blocking.map(e => e.id)).toEqual(["P-0001"]);
    expect(gateReport(base(), undefined)).toEqual({ blocking: [], after: [] });
  });
});

function site(routes: Record<string, { status?: number; type?: string; body?: string }>) {
  return async (url: string) => {
    const path = new URL(url).pathname;
    const route = routes[path] ?? { status: 404, body: "" };
    return new Response(route.body ?? "", { status: route.status ?? 200, headers: { "content-type": route.type ?? "text/html" } });
  };
}

describe("发版烟测", () => {
  const manifest = {
    require: [
      { path: "/release.json", status: 200, json: { environment: "{env}" } },
      { path: "/c/x/", status: 200, contains: "OSS" },
      { path: "/page", status: 200, notContains: ["{origin}/other"] },
    ],
    mirror: [{ path: "/c/x/", sameBody: true }, { path: "/oidc", issuerOwnOrigin: true }, { path: "/page" }],
  };

  it("require 全部满足时通过", async () => {
    const fetchImpl = site({ "/release.json": { type: "application/json", body: '{"environment":"production"}' }, "/c/x/": { body: "OSS 页" }, "/page": { body: "ok" } });
    expect(await runRequire(manifest, { origin: "https://a.example", env: "production" }, fetchImpl as never)).toEqual([]);
  });

  it("环境名不对、内部赛事页缺失、正文含另一个环境的地址都会报出来", async () => {
    const fetchImpl = site({ "/release.json": { type: "application/json", body: '{"environment":"preview"}' }, "/page": { body: "see https://a.example/other" } });
    const failures = await runRequire(manifest, { origin: "https://a.example", env: "production" }, fetchImpl as never);
    expect(failures.join("\n")).toMatch(/environment 是 "preview"，应为 production/);
    expect(failures.join("\n")).toMatch(/\/c\/x\/：状态 404/);
    expect(failures.join("\n")).toMatch(/不该出现/);
  });

  it("mirror：两边状态不同、正文不同、签发者不是各自的 origin 都会报出来", async () => {
    const previewSite = site({ "/c/x/": { body: "A" }, "/oidc": { type: "application/json", body: '{"issuer":"https://p.example/oidc"}' }, "/page": {} });
    const productionSite = site({ "/c/x/": { body: "B" }, "/page": {} });
    const fetchImpl = async (url: string) => (url.startsWith("https://p.example") ? previewSite(url) : productionSite(url));
    const failures = await runCompare(manifest, { preview: "https://p.example", production: "https://q.example" }, fetchImpl as never);
    expect(failures.join("\n")).toMatch(/\/c\/x\/：正文不同/);
    expect(failures.join("\n")).toMatch(/\/oidc：预发布 200，正式 404/);
  });

  it("mirror：签发者指向别的环境会失败", async () => {
    const wrong = site({ "/oidc": { type: "application/json", body: '{"issuer":"https://p.example/oidc"}' } });
    const failures = await runCompare({ mirror: [{ path: "/oidc", issuerOwnOrigin: true }] }, { preview: "https://p.example", production: "https://q.example" }, wrong as never);
    expect(failures.join("\n")).toMatch(/正式的 issuer 是 https:\/\/p\.example\/oidc，应为 https:\/\/q\.example\/oidc/);
  });

  it("mirror 全部一致时通过", async () => {
    const same = site({ "/c/x/": { body: "A" }, "/page": { body: "x" } });
    expect(await runCompare({ mirror: [{ path: "/c/x/", sameBody: true }, { path: "/page" }] }, { preview: "https://p.example", production: "https://q.example" }, same as never)).toEqual([]);
  });
});

describe("数据只对齐格式", () => {
  const diff = (a: unknown, b: unknown) => shapeDiff(shapeOf(a), shapeOf(b));

  it("值不同、条数不同、空数组与 null 都不算格式不同", () => {
    expect(diff({ n: 1, list: [{ id: "a" }], who: "x" }, { n: 99, list: [{ id: "b" }, { id: "c" }], who: "y" })).toEqual([]);
    expect(diff({ list: [], who: null }, { list: [{ id: "a" }], who: "y" })).toEqual([]);
  });

  it("骨架的字段多了少了、值类型变了会报出来", () => {
    expect(diff({ a: 1, b: 2 }, { a: 1 })).toEqual(["$.b 只在预发布有"]);
    expect(diff({ a: 1 }, { a: 1, c: 2 })).toEqual(["$.c 只在正式有"]);
    expect(diff({ list: [{ id: 1 }] }, { list: [{ id: "1" }] })).toEqual(["$.list[].id 的类型不同（预发布 number，正式 string）"]);
    expect(diff({ list: [] }, { list: {} })).toEqual(["$.list 的类型不同（预发布 array，正式 object）"]);
  });

  it("数组里的记录带不带可选字段取决于数据，不算格式不同", () => {
    expect(diff({ posts: [{ id: 1, deleted: true }, { id: 2 }] }, { posts: [{ id: 3, replyTo: 1 }] })).toEqual([]);
  });

  it("mirror 的 sameShape：值不同通过，骨架不同失败，不是 JSON 失败", async () => {
    const mirror = { mirror: [{ path: "/api/x", sameShape: true }] };
    const origins = { preview: "https://p.example", production: "https://q.example" };
    const json = (body: unknown) => async () => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    expect(await runCompare(mirror, origins, (async (url: string) => json(url.startsWith("https://p.example") ? { users: [{ id: 1 }], total: 1 } : { users: [], total: 7 })()) as never)).toEqual([]);
    const skeleton = await runCompare(mirror, origins, (async (url: string) => json(url.startsWith("https://p.example") ? { users: [], total: 1 } : { users: [] })()) as never);
    expect(skeleton.join("\n")).toMatch(/\/api\/x：格式不同，\$\.total 只在预发布有/);
    const html = async () => new Response("<p>x</p>", { status: 200, headers: { "content-type": "application/json" } });
    expect((await runCompare(mirror, origins, html as never)).join("\n")).toMatch(/sameShape 要求两边都是 JSON/);
  });

  it("仓库里的烟测对读库渲染的页面只比状态和类型，不比正文", () => {
    const smoke = readJson(SMOKE_FILE);
    expect(smoke.mirror.filter((item: { sameBody?: boolean }) => item.sameBody)).toEqual([]);
    expect(smoke.mirror.find((item: { path: string }) => item.path === "/c/oss-challenge-2026-1/")).toEqual({ path: "/c/oss-challenge-2026-1/" });
    expect(smoke.mirror.filter((item: { sameShape?: boolean }) => item.sameShape).map((item: { path: string }) => item.path)).toEqual(["/release.json", "/api/forum/state", "/api/public/competitions"]);
  });
});

describe("正式与 hotfix 部署工作流", () => {
  const section = (text: string, name: string) => {
    const start = text.indexOf(`\n  ${name}:\n`);
    const next = text.slice(start + 1).search(/\n {2}(?:# [^\n]*\n {2})?[a-z0-9-]+:\n/);
    return text.slice(start, next < 0 ? undefined : start + 1 + next);
  };
  for (const name of ["deploy-production", "deploy-hotfix"]) {
    const text = readFileSync(resolve(process.cwd(), `.github/workflows/${name}.yml`), "utf8");
    it(`${name}：清单没清零就不构建，部署后跑线上烟测`, () => {
      expect(section(text, "parity")).toContain("node scripts/parity.mjs check --release");
      expect(section(text, "build")).toMatch(/\n {4}needs: \[plan, evidence, cdn-plan, parity\]\n/);
      const smoke = section(text, "smoke");
      expect(smoke).toContain("needs: [plan, deploy]");
      expect(smoke).toContain("node scripts/parity.mjs smoke");
      expect(smoke).toContain("--env production");
    });
  }
  it("只有正式 tag 部署做同构对比，hotfix 不做（预发布可能在更新的提交上）", () => {
    const production = readFileSync(resolve(process.cwd(), ".github/workflows/deploy-production.yml"), "utf8");
    const hotfix = readFileSync(resolve(process.cwd(), ".github/workflows/deploy-hotfix.yml"), "utf8");
    expect(production).toContain("node scripts/parity.mjs compare --preview");
    expect(hotfix).not.toContain("parity.mjs compare");
  });
  it("预发布部署不受正式清单拦截", () => {
    expect(readFileSync(resolve(process.cwd(), ".github/workflows/deploy-preview.yml"), "utf8")).not.toContain("parity.mjs check --release");
  });
});
