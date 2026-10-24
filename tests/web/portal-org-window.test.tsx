// @vitest-environment jsdom
// 组织架构窗口（#275）：画 #274 的 GET /api/public/departments 给的部门（部门色、图标、说明、按权重排的称号）；
// 数据到之前和读不到时用和服务端初始数据一样的默认值。称号名字只写在默认值里，官网别处不写死（控制台能改名）。
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { OrgChart } from "../../app/web/sites/portal/components/os/Windows";
import { DEFAULT_DEPARTMENTS, DEPARTMENTS_URL, readDepartments } from "../../app/web/sites/portal/lib/departments";

// 开发态默认走只读样板数据；这里切到真实数据源，让窗口真的去请求部门（请求由 fetch 桩接住）。
beforeEach(() => localStorage.setItem("yugc:dev-data-source", "live"));
afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
const depts = () => within(screen.getByRole("list", { name: "部门" }));
const card = (name: string) => depts().getByRole("heading", { name }).closest("li")!;

it("数据到之前显示默认的五个部门和无部门，到了之后换成控制台改过的名字、部门色和称号", async () => {
  let resolve: (response: Response) => void = () => {};
  const fetchMock = vi.fn(() => new Promise<Response>((done) => (resolve = done)));
  vi.stubGlobal("fetch", fetchMock);

  render(<OrgChart />);
  expect(depts().getAllByRole("heading").map((item) => item.textContent)).toEqual(["AI部门", "算法部门", "硬件部门", "网安部门", "管理部门", "无部门"]);
  expect(card("AI部门").dataset.tone).toBe("y");
  expect(card("管理部门").dataset.tone).toBe("pill");
  expect(card("无部门").dataset.tone).toBe("ink");
  expect(fetchMock).toHaveBeenCalledWith(DEPARTMENTS_URL, expect.objectContaining({ signal: expect.any(AbortSignal) }));

  resolve(
    json({
      departments: [
        {
          id: "dept.design", name: "设计部门", tone: "c", icon: "image-line", description: "负责视觉和海报",
          titles: [{ id: "t.staff", name: "部员", weight: 40 }, { id: "t.head", name: "部长", weight: 60 }],
        },
      ],
    }),
  );
  await waitFor(() => expect(depts().getByRole("heading", { name: "设计部门" })).toBeTruthy());
  expect(screen.queryByRole("heading", { name: "AI部门" })).toBeNull();
  expect(card("设计部门").dataset.tone).toBe("c");
  expect(screen.getByText("负责视觉和海报")).toBeTruthy();
  // 称号按权重从高到低
  expect(within(screen.getByRole("list", { name: "设计部门的称号" })).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["部长", "部员"]);
});

it("读不到时继续显示默认值，不出错误提示", async () => {
  const fetchMock = vi.fn(() => Promise.resolve(new Response("down", { status: 502 })));
  vi.stubGlobal("fetch", fetchMock);
  render(<OrgChart />);
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  await new Promise((done) => setTimeout(done, 0));
  for (const item of DEFAULT_DEPARTMENTS) expect(depts().getByRole("heading", { name: item.name })).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
});

it("窗口关掉就取消请求", () => {
  let signal: AbortSignal | undefined;
  vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => {
    signal = init?.signal ?? undefined;
    return new Promise<Response>(() => {});
  }));
  const view = render(<OrgChart />);
  expect(signal?.aborted).toBe(false);
  view.unmount();
  expect(signal?.aborted).toBe(true);
});

describe("readDepartments", () => {
  it("部门色和图标可以为空或填错：色调换成次要文字色，图标换成人群图标；缺 id 或名字的丢掉", () => {
    const list = readDepartments({
      departments: [
        { id: "dept.a", name: "甲", tone: null, icon: null, description: null, titles: null },
        { id: "dept.b", name: "乙", tone: "rose", icon: "carbon:idea", description: "  说明  ", titles: [{ id: "x", name: "组长" }, { name: "没 id" }] },
        { id: "", name: "没 id" },
        { id: "dept.c" },
        "不是对象",
      ],
    });
    expect(list).toEqual([
      { id: "dept.a", name: "甲", tone: "ink", icon: "team-line", description: "", titles: [] },
      { id: "dept.b", name: "乙", tone: "ink", icon: "team-line", description: "说明", titles: [{ id: "x", name: "组长", weight: 0 }] },
    ]);
  });

  it("整份读不出或一个部门都没有时用默认值", () => {
    expect(readDepartments(null)).toEqual(DEFAULT_DEPARTMENTS);
    expect(readDepartments({ departments: [] })).toEqual(DEFAULT_DEPARTMENTS);
    expect(readDepartments({ departments: "x" })).toEqual(DEFAULT_DEPARTMENTS);
  });

  it("默认值和服务端初始数据一致：五个部门的色调与 Remix 图标，加上无部门", () => {
    expect(DEFAULT_DEPARTMENTS.map((item) => [item.id, item.tone, item.icon])).toEqual([
      ["dept.ai", "y", "robot-2-line"],
      ["dept.algo", "u", "code-s-slash-line"],
      ["dept.hardware", "c", "cpu-line"],
      ["dept.security", "g", "shield-keyhole-line"],
      ["dept.management", "pill", "government-line"],
      ["dept.none", "ink", "user-line"],
    ]);
  });
});

describe("称号名字只写在默认值里", () => {
  it("官网源码除了 lib/departments.ts 都不写死称号的名字（部长、副部长、部员在控制台能改名）", () => {
    // jsdom 环境里 import.meta.url 不是 file: 地址，按仓库根（vitest 的工作目录）读
    const portal = join(process.cwd(), "app/web/sites/portal");
    const sources = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return name === "assets" ? [] : sources(path);
        return /\.(tsx?|css)$/.test(name) ? [path] : [];
      });
    const names = [...new Set(DEFAULT_DEPARTMENTS.flatMap((department) => department.titles.map((title) => title.name)))];
    expect(names.length).toBeGreaterThan(0);
    const hits: string[] = [];
    for (const file of sources(portal)) {
      const name = file.slice(portal.length + 1);
      if (name === "lib/departments.ts") continue;
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, index) => {
          if (names.some((title) => line.includes(title))) hits.push(`${name}:${index + 1}`);
        });
    }
    expect(hits).toEqual([]);
  });
});
