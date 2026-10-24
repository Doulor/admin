// 比赛官网 SDK（#278，CONTRACT-278 §3）：只发匿名 GET、错误归成四种、深链跟着服务端给的 app_url、subscribe 失败不抛并按间隔重试。
import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient, isCompetitionError, type Snapshot } from "@shared/competition-sdk";

const competition = {
  id: "oss-challenge-2026-1", name: "开源赛", kind: "internal", start_at: 1, end_at: 2, signup_deadline: null, url: null, description: "",
  status: "ongoing", signup: { enabled: true, participation: "team", team_min: 1, team_max: 3, scoring: "contribution" },
  site_url: "/c/oss/", app_url: "/?open=competitions&competition=oss-challenge-2026-1&from=site", prizes: [], grade_factors: [], finalized_at: null,
};
const snapshot: Snapshot = {
  competition: competition as Snapshot["competition"],
  leaderboard: { updated_at: 5, individuals: [], teams: [] },
  feed: { items: [], next_cursor: null },
  stats: { participants: 0, teams: 0, merged_prs: 0, accepted_issues: 0, total_points: 0, updated_at: 5 },
};

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

afterEach(() => vi.useRealTimers());

describe("competition SDK", () => {
  it("reads the public endpoints anonymously from the same origin by default", async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return json(200, String(url).endsWith("/snapshot") ? snapshot : {});
    });
    const client = createClient({ competition: "oss-challenge-2026-1", fetch });
    await client.getCompetition();
    await client.getLeaderboard();
    await client.getFeed({ cursor: "abc=", limit: 80 });
    await client.getStats();
    await client.getParticipants({ cursor: "p=", limit: 500 });
    await client.getTeams();
    await client.getSnapshot();
    expect(calls.map(call => call.url)).toEqual([
      "/api/public/competitions/oss-challenge-2026-1",
      "/api/public/competitions/oss-challenge-2026-1/leaderboard",
      "/api/public/competitions/oss-challenge-2026-1/feed?cursor=abc%3D&limit=50",
      "/api/public/competitions/oss-challenge-2026-1/stats",
      "/api/public/competitions/oss-challenge-2026-1/participants?cursor=p%3D&limit=200",
      "/api/public/competitions/oss-challenge-2026-1/teams",
      "/api/public/competitions/oss-challenge-2026-1/snapshot",
    ]);
    for (const call of calls) {
      expect(call.init?.method).toBe("GET");
      expect(call.init?.credentials).toBe("omit");
    }
  });

  it("builds deep links from the origin, and follows the app_url the server returns", async () => {
    const fetch = vi.fn(async () => json(200, competition));
    const client = createClient({ competition: "a b", origin: "https://prev.yangtzeu.work/", fetch });
    expect(client.signupUrl()).toBe("https://prev.yangtzeu.work/?open=competitions&competition=a%20b");
    expect(client.teamUrl()).toBe("https://prev.yangtzeu.work/?open=competitions&competition=a%20b&view=team");
    await client.getCompetition();
    expect(client.signupUrl()).toBe(`https://prev.yangtzeu.work${competition.app_url}`);
    expect(client.teamUrl()).toBe(`https://prev.yangtzeu.work${competition.app_url}&view=team`);
    expect(() => createClient({ competition: "" })).toThrow(TypeError);
  });

  it("rejects with one of four error codes", async () => {
    const respond = (response: () => Response | Promise<Response>) => createClient({ competition: "x", fetch: vi.fn(async () => response()) });
    await expect(respond(() => json(404, { error: "not_found" })).getStats()).rejects.toEqual({ code: "not_found", status: 404 });
    await expect(respond(() => json(429, { error: "rate_limited", retry_after: 42 })).getStats()).rejects.toEqual({ code: "rate_limited", status: 429, retry_after: 42 });
    await expect(respond(() => new Response("busy", { status: 429, headers: { "retry-after": "7" } })).getStats()).rejects.toEqual({ code: "rate_limited", status: 429, retry_after: 7 });
    await expect(respond(() => json(500, {})).getStats()).rejects.toEqual({ code: "server", status: 500 });
    await expect(respond(() => new Response("<html>", { status: 200 })).getStats()).rejects.toEqual({ code: "server", status: 200 });
    await expect(respond(() => { throw new TypeError("Failed to fetch"); }).getStats()).rejects.toEqual({ code: "network" });
    expect(isCompetitionError({ code: "network" })).toBe(true);
    expect(isCompetitionError(new Error("x"))).toBe(false);
  });

  it("subscribe keeps polling, reports errors without throwing, waits out rate limits and stops when cancelled", async () => {
    vi.useFakeTimers();
    const responses = [json(200, snapshot), json(503, {}), json(429, { retry_after: 120 }), json(200, snapshot)];
    const fetch = vi.fn(async () => responses.shift() ?? json(200, snapshot));
    const client = createClient({ competition: "oss-challenge-2026-1", fetch });
    const updates: unknown[] = [];
    const stop = client.subscribe(update => updates.push(update), { interval: 15_000 });
    await vi.advanceTimersByTimeAsync(0);
    expect(updates).toEqual([snapshot]);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(updates[1]).toEqual({ error: { code: "server", status: 503 } });
    await vi.advanceTimersByTimeAsync(15_000);
    expect(updates[2]).toEqual({ error: { code: "rate_limited", status: 429, retry_after: 120 } });
    // 限流时等够 retry_after（120 秒），不是 15 秒
    await vi.advanceTimersByTimeAsync(60_000);
    expect(updates).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(updates).toHaveLength(4);
    stop();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(updates).toHaveLength(4);
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it("does not poll faster than every five seconds", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(async () => json(200, snapshot));
    const stop = createClient({ competition: "x", fetch }).subscribe(() => undefined, { interval: 100 });
    await vi.advanceTimersByTimeAsync(4_900);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(200);
    expect(fetch).toHaveBeenCalledTimes(2);
    stop();
  });
});
