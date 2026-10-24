// @vitest-environment jsdom
// 「代码仓库」窗口（#275）：列 #274 的 GET /api/public/gitlab/projects 给的公开项目，点项目在新标签页打开；
// GitLab 连不上（unavailable）、接口读不到、没有公开项目时照实说，底部总能去代码仓库。
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CodeRepos } from "../../app/web/sites/portal/components/os/Windows";
import { CODE_REPOS_URL, readCodeRepos } from "../../app/web/sites/portal/lib/codeRepos";
import { links } from "../../app/web/sites/portal/lib/links";

// 开发态默认走只读样板数据；这里切到真实数据源，让窗口真的去请求（请求由 fetch 桩接住）。
beforeEach(() => localStorage.setItem("yugc:dev-data-source", "live"));
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const project = (name: string, at: string | null, description: string | null = null) => ({
  id: name.length, name, path_with_namespace: `geek/${name}`, description,
  web_url: `https://git.yangtzeu.work/geek/${name}`, http_url_to_repo: `https://git.yangtzeu.work/geek/${name}.git`, last_activity_at: at,
});

function serve(response: () => Promise<Response>) {
  const fetchMock = vi.fn(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function expectGitlabFooter() {
  const link = screen.getByRole("link", { name: /打开代码仓库/ });
  expect(link.getAttribute("href")).toBe(links.gitlab());
  expect(link.getAttribute("target")).toBe("_blank");
}

it("有公开项目：按最近活动从新到旧列出，项目在新标签页打开，没有说明时写路径", async () => {
  const fetchMock = serve(async () =>
    json({ projects: [project("old", "2026-01-02T03:04:05.000Z", "旧项目"), project("fresh", new Date(Date.now() - 3 * 864e5).toISOString())] }),
  );
  render(<CodeRepos />);
  expect(screen.getByText("正在读取公开项目…")).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledWith(CODE_REPOS_URL, expect.objectContaining({ signal: expect.any(AbortSignal) }));
  const list = await screen.findByRole("list", { name: "公开项目" });
  const items = within(list).getAllByRole("link");
  expect(items.map((item) => item.getAttribute("href"))).toEqual(["https://git.yangtzeu.work/geek/fresh", "https://git.yangtzeu.work/geek/old"]);
  for (const item of items) {
    expect(item.getAttribute("target")).toBe("_blank");
    expect(item.getAttribute("rel")).toBe("noopener noreferrer");
  }
  expect(within(items[0]).getByText("geek/fresh")).toBeTruthy();
  expect(within(items[0]).getByText("3 天前")).toBeTruthy();
  expect(within(items[1]).getByText("旧项目")).toBeTruthy();
  expectGitlabFooter();
});

it("GitLab 连不上：说暂时连不上，不显示空列表", async () => {
  serve(async () => json({ projects: [], unavailable: true }));
  render(<CodeRepos />);
  expect(await screen.findByText(/代码仓库暂时连不上/)).toBeTruthy();
  expect(screen.queryByRole("list", { name: "公开项目" })).toBeNull();
  expectGitlabFooter();
});

it("接口读不到：说没加载出来；没有公开项目：照实说", async () => {
  serve(async () => json({ error: "internal" }, 502));
  const view = render(<CodeRepos />);
  expect(await screen.findByText(/公开项目没加载出来/)).toBeTruthy();
  expectGitlabFooter();
  view.unmount();

  serve(async () => json({ projects: [] }));
  render(<CodeRepos />);
  expect(await screen.findByText(/还没有公开的项目/)).toBeTruthy();
});

it("窗口关掉就取消请求", async () => {
  let signal: AbortSignal | undefined;
  vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => {
    signal = init?.signal ?? undefined;
    return new Promise<Response>(() => {});
  }));
  const view = render(<CodeRepos />);
  await waitFor(() => expect(signal?.aborted).toBe(false));
  view.unmount();
  expect(signal?.aborted).toBe(true);
});

describe("readCodeRepos", () => {
  it("只留有名字和 http(s) 地址的项目；时间认 ISO 字符串和毫秒，读不出是 null 并排到最后", () => {
    const state = readCodeRepos({
      projects: [
        project("no-time", null),
        { ...project("bad-url", "2026-10-01T00:00:00Z"), web_url: "javascript:alert(1)" },
        { ...project("", "2026-10-01T00:00:00Z") },
        { ...project("ms", null), last_activity_at: Date.UTC(2026, 9, 2) },
        project("iso", "2026-10-01T00:00:00Z", "  说明  "),
        "不是对象",
      ],
    });
    expect(state.status).toBe("ready");
    if (state.status !== "ready") return;
    expect(state.projects.map((item) => [item.name, item.activeAt])).toEqual([
      ["ms", Date.UTC(2026, 9, 2)],
      ["iso", Date.UTC(2026, 9, 1)],
      ["no-time", null],
    ]);
    expect(state.projects[1]).toEqual({
      name: "iso", path: "geek/iso", description: "说明", url: "https://git.yangtzeu.work/geek/iso", cloneUrl: "https://git.yangtzeu.work/geek/iso.git", activeAt: Date.UTC(2026, 9, 1),
    });
  });

  it("unavailable 为 true 时是连不上；形状不对是读不到", () => {
    expect(readCodeRepos({ projects: [], unavailable: true })).toEqual({ status: "unavailable" });
    expect(readCodeRepos({ projects: [] })).toEqual({ status: "ready", projects: [] });
    for (const body of [null, {}, { projects: "x" }, []]) expect(readCodeRepos(body)).toEqual({ status: "error" });
  });
});
