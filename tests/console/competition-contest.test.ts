// 比赛官网、待确认贡献、计分规则与奖项、定榜、兑奖（#278）控制台页面的纯逻辑与只读样板。
// 和 competition-hub.test.ts 一样不挂载 Vue 页面，只测 lib/competition-contest.ts 与 mock 的 GET。
import { describe, expect, it } from "vitest";
import {
  GRADE_KEYS, acceptPointsError, codeError, collectSummary, emptyPrizeRow, factorText, fmtBytes, normalizeCode, prizeText, redeemFailure,
  rejectReport, rulesErrors, rulesForm, rulesPayload, rulesValid, siteFileError, slugError, versionState, type RulesForm,
} from "../../app/console/src/lib/competition-contest";
import { ApiError } from "../../app/console/src/lib/http";
import { routeConsole } from "../../app/console/src/mock/console";
import { normalizePrizeCode } from "../../app/server/src/lib/competition-prizes";
import { rulesBody } from "../../app/server/src/lib/competition-contract";

const RULES = {
  grade_factors: { year1: 150, year2: 130, year3: 110, year4: 100, graduated: 100, none: 100 },
  prizes: [{ from: 1, to: 1, amount_cny: 700, title: "GPT 5x 订阅的价格" }, { from: 2, to: 3, amount_cny: 140, title: "GPT Plus 订阅的价格" }, { from: 4, to: 8, amount_cny: 70, title: "" }],
  gitlab_projects: ["geek/admin"],
};
const form = (patch: Partial<RulesForm> = {}): RulesForm => ({ ...rulesForm(RULES), ...patch });

describe("rules form", () => {
  it("round-trips the owner's first-period rules without changing a value", () => {
    const value = rulesForm(RULES);
    expect(value.factors).toEqual({ year1: "1.5", year2: "1.3", year3: "1.1", year4: "1.0", graduated: "1.0", none: "1.0" });
    expect(rulesValid(rulesErrors(value))).toBe(true);
    expect(rulesPayload(value)).toEqual(RULES);
    expect([factorText(150), factorText(100), factorText(125)]).toEqual(["1.5", "1.0", "1.25"]);
  });

  it("keeps factors between 0.5 and 3 with at most two decimals, like the server's 50–300 percent", () => {
    const factor = (value: string) => rulesErrors(form({ factors: { ...form().factors, year1: value } })).factors.year1;
    for (const ok of ["0.5", "3", "1.25", " 2 "]) expect(factor(ok), ok).toBeUndefined();
    for (const bad of ["0.49", "3.01", "1.255", "", "abc", "-1"]) expect(factor(bad), bad).toBeTruthy();
    const server = rulesBody.properties.grade_factors.properties.year1;
    expect([server.minimum, server.maximum]).toEqual([50, 300]);
    expect(rulesPayload(form({ factors: { ...form().factors, year2: "1.25" } })).grade_factors.year2).toBe(125);
  });

  it("needs prize ranks in order without overlap, whole-yuan amounts and short titles", () => {
    const prizes = (rows: RulesForm["prizes"]) => rulesErrors(form({ prizes: rows })).prizes;
    const row = (from: string, to: string, amount = "10", title = "") => ({ from, to, amount, title });
    expect(prizes([row("1", "1"), row("2", "3")])).toEqual(["", ""]);
    expect(prizes([row("2", "1")])[0]).toContain("不能大于");
    expect(prizes([row("1", "3"), row("3", "4")])[1]).toContain("不能重叠");
    expect(prizes([row("0", "1")])[0]).toContain("1 到 100");
    expect(prizes([row("1", "101")])[0]).toContain("1 到 100");
    expect(prizes([row("1", "1", "1.5")])[0]).toContain("金额");
    expect(prizes([row("1", "1", "100001")])[0]).toContain("金额");
    expect(prizes([row("1", "1", "10", "字".repeat(41))])[0]).toContain("40 个字");
    expect(rulesErrors(form({ prizes: Array.from({ length: 21 }, (_, i) => row(String(i + 1), String(i + 1))) })).prizeOrder).toContain("20 档");
    expect(emptyPrizeRow(row("4", "8"))).toEqual({ from: "9", to: "9", amount: "", title: "" });
    expect(emptyPrizeRow()).toEqual({ from: "1", to: "1", amount: "", title: "" });
    expect(prizeText({ from: 4, to: 8, amount_cny: 70 })).toBe("第 4–8 名 · 70 元");
  });

  it("accepts GitLab project paths one per line, at most ten, and drops duplicates", () => {
    expect(rulesPayload(form({ projects: "geek/admin\n geek/sub/portal \ngeek/admin" })).gitlab_projects).toEqual(["geek/admin", "geek/sub/portal"]);
    expect(rulesErrors(form({ projects: "geek" })).projects).toBeTruthy();
    expect(rulesErrors(form({ projects: "a/b/c/d/e/f" })).projects).toBeTruthy();
    expect(rulesErrors(form({ projects: Array.from({ length: 11 }, (_, i) => `geek/p${i}`).join("\n") })).projects).toContain("10 个");
    expect(rulesErrors(form({ projects: "" })).projects).toBeUndefined();
  });

  it("lists every grade the server knows", () => {
    expect(GRADE_KEYS).toEqual(Object.keys(rulesBody.properties.grade_factors.properties));
  });
});

describe("candidates", () => {
  it("keeps accepted points inside the record's range", () => {
    expect(acceptPointsError("pr", "15")).toBeNull();
    expect(acceptPointsError("pr", "100")).toBeNull();
    expect(acceptPointsError("pr", "101")).toContain("15–100");
    expect(acceptPointsError("issue", "4")).toContain("5–30");
    expect(acceptPointsError("issue", "7.5")).toBeTruthy();
  });

  it("summarises the last collection run, and says so when there is none", () => {
    expect(collectSummary(null)).toContain("还没有收集过");
    const at = Date.UTC(2026, 9, 24, 7, 5);
    expect(collectSummary({ at, fetched: 12, created: 2, skipped: 1, accepted: 1, revoked: 0, error: null })).toBe("10-24 15:05 收集：读了 12 条，新增 2 条，跳过 1 条，按标签加分 1 条，撤销 0 条。");
    expect(collectSummary({ at, fetched: 0, created: 0, skipped: 0, accepted: 0, revoked: 0, error: "gitlab_unreachable" })).toBe("10-24 15:05 收集没有完成：gitlab_unreachable");
  });
});

describe("site", () => {
  it("checks the slug and the picked file before uploading", () => {
    expect(slugError("oss-challenge-2026-1")).toBeNull();
    for (const bad of ["ab", "-oss", "OSS", "oss_2026", "a".repeat(33)]) expect(slugError(bad), bad).toBeTruthy();
    expect(siteFileError({ name: "site.zip", size: 20 * 1024 * 1024 })).toBeNull();
    expect(siteFileError({ name: "site.zip", size: 20 * 1024 * 1024 + 1 })).toContain("20MB");
    expect(siteFileError({ name: "site.tar.gz", size: 10 })).toContain(".zip");
    expect([fmtBytes(512), fmtBytes(227_873), fmtBytes(13_107_200)]).toEqual(["512 B", "222.5 KB", "12.5 MB"]);
  });

  it("names the version state and reads the rejection report", () => {
    expect(versionState({ id: "a", status: "passed" }, "a")).toEqual({ text: "在线", tone: "success" });
    expect(versionState({ id: "b", status: "passed" }, "a").text).toBe("通过");
    expect(versionState({ id: "c", status: "rejected" }, null)).toEqual({ text: "没通过", tone: "danger" });
    const rejected = new ApiError(422, "site_rejected", "x", undefined, { error: "site_rejected", report: ["index.html：缺少", 3] });
    expect(rejectReport(rejected)).toEqual(["index.html：缺少"]);
    expect(rejectReport(new ApiError(403, "step_up_required", "x"))).toBeNull();
    // 宿主 nginx 按大小拒收时回的是 HTML，不是 JSON
    expect(rejectReport(new ApiError(413, "request_failed", "请求失败（HTTP 413）"))).toEqual(["文件超过了网关允许的上传大小，没有传到服务端（HTTP 413）。"]);
  });
});

describe("prize codes", () => {
  it("normalizes the same way as the server", () => {
    for (const input of ["YUGC-7K2M-9QXA-4T8B-R3NW", "yugc 7k2m 9qxa 4t8b r3nw", "7K2M9QXA4T8BR3NW", "YUGC-7K2M-9QXA-4T8B-R3NW ", "yugc-ik2m-9qxa-4t8b-r3nw", "YUGC-0K2M-9QXA-4T8B-R3NW", "YUGC-OK2M-9QXA-4T8B-R3NW", "short", "YUGC-7K2M-9QXA-4T8B-R3NU"]) {
      expect(normalizeCode(input), input).toBe(normalizePrizeCode(input));
    }
    expect(codeError("")).toContain("请输入");
    expect(codeError("YUGC-1234")).toContain("16 位");
    expect(codeError("yugc-7k2m-9qxa-4t8b-r3nw")).toBeNull();
  });

  it("explains not found, already redeemed and too many wrong codes, and leaves the rest to ErrorAlert", () => {
    expect(redeemFailure(new ApiError(404, "code_not_found", "x"))?.text).toContain("没有这个兑奖码");
    const prize = { id: "p1", redeemed_at: 5 };
    expect(redeemFailure(new ApiError(409, "already_redeemed", "x", undefined, { error: "already_redeemed", prize }))).toEqual({ text: "这个兑奖码已经核销过了，不能再兑一次。", prize });
    expect(redeemFailure(new ApiError(429, "rate_limited", "x"))?.text).toContain("一小时");
    expect(redeemFailure(new ApiError(403, "step_up_required", "x"))).toBeNull();
    expect(redeemFailure(new Error("x"))).toBeNull();
  });
});

describe("mock reads for the competition tabs", () => {
  const read = (path: string) => routeConsole(new URL(path, "http://mock.local")) as Record<string, unknown>;
  it("serves candidates by status, the rules, the site and a final preview for the first period", () => {
    const pending = read("/api/console/competitions/c1001/candidates?status=pending") as { items: { status: string }[]; counts: Record<string, number> };
    expect(pending.items.every(row => row.status === "pending")).toBe(true);
    expect(pending.counts).toEqual({ pending: 2, accepted: 1, rejected: 0 });
    const rules = read("/api/console/competitions/c1001/rules") as { prizes: unknown[]; gitlab_projects: string[] };
    expect(rules.prizes).toHaveLength(3);
    expect(rules.gitlab_projects).toEqual(["geek/admin"]);
    const site = read("/api/console/competitions/c1001/site") as { live_version_id: string; versions: { id: string }[] };
    expect(site.versions.map(row => row.id)).toContain(site.live_version_id);
    const final = read("/api/console/competitions/c1001/final") as { finalized_at: null; preview: { rank: number; points: number; amount_cny: number | null }[] };
    expect(final.finalized_at).toBeNull();
    // 有效的两条积分按系数加权：90 与 22
    expect(final.preview.map(row => [row.rank, row.points, row.amount_cny])).toEqual([[1, 90, 700], [2, 22, 140]]);
  });
});
