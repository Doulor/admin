// @vitest-environment jsdom
// 比赛窗口里 #278 加的部分：奖项、年级系数与「有用」规则的读入和展示、「比赛官网」入口、
// 官网「去组队」的深链（?competition=<id>&view=team），以及「我的参赛」里定榜后的名次与兑奖码。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import CompetitionsApp from "../../app/web/sites/portal/components/os/competitions/CompetitionsApp";
import CompetitionDetail from "../../app/web/sites/portal/components/os/competitions/CompetitionDetail";
import type { Account } from "../../app/web/sites/portal/lib/account";
import { readCompetition, readGradeFactors, readPrizes, readScoring, type Competition } from "../../app/web/sites/portal/lib/competitions";
import { factorText, hubPaths, rankRange, readMyResults, trivialRuleText } from "../../app/web/sites/portal/lib/competitionHub";
import { scoringView } from "../../app/server/src/lib/competition-rubric";

beforeEach(() => localStorage.setItem("yugc:dev-data-source", "live"));
afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const NOW = Date.now();

const PRIZES = [
  { from: 1, to: 1, amount_cny: 700, title: "GPT 5x 订阅的价格" },
  { from: 2, to: 3, amount_cny: 140, title: "GPT Plus 订阅的价格" },
  { from: 4, to: 8, amount_cny: 70, title: "" },
];
const FACTORS = [
  { grade: "year1", label: "大一", factor: 3.5 }, { grade: "year2", label: "大二", factor: 2.2 }, { grade: "year3", label: "大三", factor: 1.4 },
  { grade: "year4", label: "大四", factor: 1 }, { grade: "graduated", label: "已毕业", factor: 1 }, { grade: "none", label: "无年级", factor: 1 },
];

const competition = (over: Record<string, unknown> = {}): Competition => readCompetition({
  id: "oss-challenge-2026-1", name: "OSS CHALLENGE 2026 第一期", kind: "internal",
  start_at: NOW - DAY, end_at: NOW + 20 * DAY, signup_deadline: NOW + 10 * DAY,
  url: null, description: "", status: "registering",
  signup: { enabled: true, participation: "team", team_min: 1, team_max: 3, scoring: "contribution" },
  site_url: "/c/oss-challenge-2026-1/", prizes: PRIZES, grade_factors: FACTORS, scoring: scoringView(), finalized_at: null,
  ...over,
})!;

const ACCOUNT: Account = { login: "ada", avatarUrl: null, consoleLink: false, accountId: "a1" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function serve(routes: Record<string, unknown>) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === "string" ? input : input instanceof URL ? `${input.pathname}${input.search}` : input.url;
    const key = `${(init.method ?? "GET").toUpperCase()} ${url}`;
    calls.push(key);
    const reply = routes[key];
    if (reply === undefined) return json({ error: "unexpected_request" }, 500);
    const out = typeof reply === "function" ? (reply as () => unknown)() : reply;
    return out instanceof Response ? out : json(out);
  }));
  return calls;
}

const status = {
  competition_id: "oss-challenge-2026-1", settings: { enabled: true, participation: "team", team_min: 1, team_max: 3, scoring: "contribution" },
  writable: true, signup: null, state: "none", team: null, role: null, pending: [],
  stats: { signups: 0, teams: 0, locked_teams: 0, confirmed_people: 0, unplaced: 0 }, actions: ["signup"],
};

describe("奖项与年级系数的读入", () => {
  it("名次说不通、金额不是非负整数的奖项丢掉；系数要大于 0", () => {
    expect(readPrizes([...PRIZES, { from: 3, to: 1, amount_cny: 10, title: "x" }, { from: 1, to: 1, amount_cny: -1 }, { from: 0, to: 1, amount_cny: 1 }, "x"])).toEqual(PRIZES);
    expect(readPrizes(undefined)).toEqual([]);
    expect(readGradeFactors([...FACTORS, { grade: "x", label: "", factor: 1 }, { grade: "y", label: "研一", factor: 0 }, { label: "研二", factor: Number.NaN }])).toEqual(FACTORS);
    const item = competition({ prizes: "bad", grade_factors: null, scoring: { points: [] }, finalized_at: "soon" });
    expect([item.prizes, item.grade_factors, item.scoring, item.finalized_at]).toEqual([[], [], null, null]);
    expect([factorText(1.5), factorText(1), factorText(1.25), factorText(1.3)]).toEqual(["×1.5", "×1.0", "×1.25", "×1.3"]);
    expect([rankRange(1, 1), rankRange(4, 8)]).toEqual(["第 1 名", "第 4–8 名"]);
  });

  it("定榜结果：缺比赛 id 或定榜时间的丢掉，兑奖码格式不对的当作没有奖", () => {
    const prize = { amount_cny: 700, title: "GPT 5x 订阅的价格", code: "YUGC-AB12-CD34-EF56-GH78", redeemed_at: null };
    expect(readMyResults({ items: [
      { competition_id: "c1", name: "第一期", finalized_at: 5, rank: 1, points: 120, prize },
      { competition_id: "c2", name: "第二期", finalized_at: 6, rank: null, points: 0, prize: { ...prize, code: "<b>" } },
      { name: "缺 id", finalized_at: 7, rank: 1, points: 1, prize: null },
      { competition_id: "c3", finalized_at: null },
    ] })).toEqual([
      { competition_id: "c1", name: "第一期", finalized_at: 5, rank: 1, points: 120, prize },
      { competition_id: "c2", name: "第二期", finalized_at: 6, rank: null, points: 0, prize: null },
    ]);
    expect(readMyResults({})).toBeNull();
  });
});

describe("两档计分表的读入", () => {
  it("服务端的表整张读进来；缺一格就整张不要", () => {
    const scoring = readScoring(scoringView())!;
    expect(scoring.points.pr.critical.core).toBe(100);
    expect(scoring.points.issue.normal.edge).toBe(5);
    expect(scoring.core.map((level) => level.label)).toEqual(["边缘", "业务", "核心"]);
    expect(trivialRuleText(scoring)).toBe("防刷：每人每周「一般 × 边缘」只算 1 条，后面的记 0 分，记录照留。");
    const missing = { ...scoringView(), points: scoringView().points.slice(1) };
    expect(readScoring(missing)).toBeNull();
    expect(readScoring({ ...scoringView(), penalty: "x" })).toBeNull();
    expect(readScoring(null)).toBeNull();
  });
});

describe("比赛详情：计分、奖项与官网入口", () => {
  it("概览写出「有用」才计分、两档基础分表、防刷、年级系数与三档奖项，Hero 里有比赛官网", async () => {
    serve({});
    render(<CompetitionDetail item={competition()} now={NOW} account="signed_out" />);
    const factors = screen.getByRole("list", { name: "年级系数" });
    expect(within(factors).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["大一×3.5", "大二×2.2", "大三×1.4", "大四×1.0", "已毕业×1.0", "无年级×1.0"]);
    const mr = screen.getByRole("table", { name: "合入的 MR" });
    expect(within(mr).getAllByRole("row").map((row) => row.textContent)).toEqual(["重要程度边缘业务核心", "一般152540", "重要254565", "关键4065100"]);
    expect(within(screen.getByRole("table", { name: "Issue" })).getAllByRole("row")[1].textContent).toBe("一般5812");
    expect(screen.getByText(/不看代码行数/, { selector: ".pt-cx-rubric > p" })).toBeTruthy();
    expect(screen.getByText(/防刷：每人每周「一般 × 边缘」只算 1 条/)).toBeTruthy();
    expect(screen.getByText(/Issue 和 MR 要被组织者标记「有用」才加分/)).toBeTruthy();
    expect(screen.getByText(/天梯每 10 秒刷新/)).toBeTruthy();
    const prizes = screen.getByRole("heading", { name: "奖项" }).closest("section")!;
    expect(within(prizes).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "第 1 名700 元GPT 5x 订阅的价格", "第 2–3 名140 元GPT Plus 订阅的价格", "第 4–8 名70 元",
    ]);
    expect(within(prizes).getByText(/比赛结束后定榜/)).toBeTruthy();
    const site = screen.getByRole("link", { name: /比赛官网/ });
    expect(site.getAttribute("href")).toBe("/c/oss-challenge-2026-1/");
    expect(site.getAttribute("target")).toBe("_blank");
  });

  it("没有奖项、没发布官网时不显示这两块；定榜后奖项下写定榜时间", () => {
    serve({});
    const { unmount } = render(<CompetitionDetail item={competition({ prizes: [], site_url: null })} now={NOW} account="signed_out" />);
    expect(screen.queryByRole("heading", { name: "奖项" })).toBeNull();
    expect(screen.queryByRole("link", { name: /比赛官网/ })).toBeNull();
    unmount();
    render(<CompetitionDetail item={competition({ finalized_at: NOW - HOUR })} now={NOW} account="signed_out" />);
    expect(screen.getByText(/已定榜，名次不再变化/)).toBeTruthy();
  });
});

describe("比赛应用：官网深链与定榜结果", () => {
  it("?competition=<id>&view=team 选中那场比赛并打开队伍页签，读完从地址里去掉、其余参数留着", async () => {
    window.history.replaceState(null, "", "/?competition=oss-challenge-2026-1&view=team&from=site");
    serve({
      "GET /api/public/competitions": () => ({ competitions: [// 另一场开始得更早，排在列表第一个：选中的是 OSS 只能是深链起的作用
      competition({ id: "aaa", name: "另一场", site_url: null, start_at: NOW - 2 * DAY }), competition()] }),
      "GET /api/me/competitions": () => ({ items: [], pending_total: 0 }),
      "GET /api/competitions/oss-challenge-2026-1/my-status": () => status,
      "GET /api/competitions/oss-challenge-2026-1/teams": () => ({ items: [] }),
    });
    render(<CompetitionsApp account={ACCOUNT} />);
    expect(await screen.findByRole("heading", { name: "OSS CHALLENGE 2026 第一期" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /队伍/ }).getAttribute("aria-selected")).toBe("true");
    expect(window.location.search).toBe("?from=site");
  });

  it("手机上深链直接进详情；没有这场比赛时停在列表", async () => {
    window.history.replaceState(null, "", "/?competition=oss-challenge-2026-1");
    serve({
      "GET /api/public/competitions": () => ({ competitions: [competition()] }),
      "GET /api/me/competitions": () => ({ items: [], pending_total: 0 }),
      "GET /api/competitions/oss-challenge-2026-1/my-status": () => status,
    });
    const { unmount } = render(<CompetitionsApp phone account={ACCOUNT} />);
    expect(await screen.findByRole("heading", { name: "OSS CHALLENGE 2026 第一期" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "概览" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByRole("list", { name: "比赛列表" })).toBeNull();
    unmount();

    window.history.replaceState(null, "", "/?competition=missing");
    render(<CompetitionsApp phone account={ACCOUNT} />);
    expect(await screen.findByRole("list", { name: "比赛列表" })).toBeTruthy();
    expect(window.location.search).toBe("");
  });

  it("「我的参赛」顶上列定榜结果：得奖的给兑奖码和复制，已兑奖写兑奖时间", async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    const calls = serve({
      "GET /api/public/competitions": () => ({ competitions: [competition({ end_at: NOW - DAY, start_at: NOW - 30 * DAY, signup_deadline: NOW - 20 * DAY, finalized_at: NOW - HOUR })] }),
      "GET /api/me/competitions": () => ({ items: [{ competition_id: "oss-challenge-2026-1", state: "confirmed", pending_count: 0, team: null }], pending_total: 0 }),
      "GET /api/me/competition-results": () => ({ items: [
        { competition_id: "oss-challenge-2026-1", name: "OSS CHALLENGE 2026 第一期", finalized_at: NOW - HOUR, rank: 2, points: 180, prize: { amount_cny: 140, title: "GPT Plus 订阅的价格", code: "YUGC-AB12-CD34-EF56-GH78", redeemed_at: null } },
        { competition_id: "old", name: "上一期", finalized_at: NOW - 90 * DAY, rank: 1, points: 300, prize: { amount_cny: 700, title: "", code: "YUGC-ZZ12-CD34-EF56-GH78", redeemed_at: NOW - 80 * DAY } },
      ] }),
      "GET /api/competitions/oss-challenge-2026-1/my-status": () => ({ ...status, writable: false, state: "confirmed", actions: [] }),
    });
    render(<CompetitionsApp account={ACCOUNT} />);
    const group = await screen.findByRole("group", { name: "切换列表" });
    expect(calls).not.toContain(`GET ${hubPaths.results}`);
    fireEvent.click(within(group).getByRole("button", { name: /我的参赛/ }));
    const results = await screen.findByRole("region", { name: "比赛结果" });
    const [first, second] = within(results).getAllByRole("article");
    expect(within(first!).getByText(/第 2 名 · 180 分/)).toBeTruthy();
    expect(within(first!).getByText(/140 元（GPT Plus 订阅的价格） · 凭兑奖码找组织者兑奖/)).toBeTruthy();
    expect(within(first!).getByLabelText("兑奖码").textContent).toBe("YUGC-AB12-CD34-EF56-GH78");
    fireEvent.click(within(first!).getByRole("button", { name: "复制" }));
    await waitFor(() => expect(within(first!).getByRole("button", { name: "已复制" })).toBeTruthy());
    expect(writeText).toHaveBeenCalledWith("YUGC-AB12-CD34-EF56-GH78");
    expect(within(second!).getByText(/700 元 · .* 已兑奖/)).toBeTruthy();
  });

  it("定榜结果读不到时不挡「我的参赛」列表", async () => {
    serve({
      "GET /api/public/competitions": () => ({ competitions: [competition()] }),
      "GET /api/me/competitions": () => ({ items: [{ competition_id: "oss-challenge-2026-1", state: "signed_up", pending_count: 0, team: null }], pending_total: 0 }),
      "GET /api/me/competition-results": () => json({ error: "internal" }, 500),
      "GET /api/competitions/oss-challenge-2026-1/my-status": () => status,
    });
    render(<CompetitionsApp account={ACCOUNT} />);
    fireEvent.click(within(await screen.findByRole("group", { name: "切换列表" })).getByRole("button", { name: /我的参赛/ }));
    expect(await screen.findByRole("list", { name: "我的参赛" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "比赛结果" })).toBeNull();
  });
});
