// @vitest-environment jsdom
// 招新总开关在官网这一侧（#284）：GET /api/public/config 的 apply_open 关着时，「加入我们」窗口整个换成关闭页，没有表单，也没有注册、登录这类报名入口；
// 读到之前不先闪出表单；读不到或没有这个字段按开放算；寄信时服务端回 403 apply_closed（开关在写信的时候被关了）同样换成关闭页。
// 桌面上其它叫人去报名的地方（图标说明、「新来的看这里」便签、「关于极客班」窗口）关着时不再这么说，并且在窗口读到开关后跟着变。
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PROMO_COOKIE } from "../../app/web/sites/portal/lib/promo";

// 壁纸图层、宣传片播放层与本用例无关，换成空组件；壁纸不预取
vi.mock("../../app/web/sites/portal/components/os/Wallpaper", () => ({ default: () => null }));
vi.mock("../../app/web/sites/portal/components/PromoLazy", () => ({ LazyPromoPlayer: () => null }));
vi.mock("../../app/web/sites/portal/lib/wallpapers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../app/web/sites/portal/lib/wallpapers")>()),
  prefetchWallpapersWhenIdle: () => () => undefined,
}));

import JoinBox from "../../app/web/sites/portal/components/os/JoinBox";
import YugcOs from "../../app/web/sites/portal/components/os/YugcOs";
import { StartNote } from "../../app/web/sites/portal/components/os/Widgets";
import { applyOpenOf, joinView } from "../../app/web/sites/portal/lib/applyOpen";
import { OS_APPS, visibleApps } from "../../app/web/sites/portal/lib/osApps";

type Reply = { status: number; body: unknown };
let config: unknown;
let configMode: "reply" | "down" | "hang";
let me: unknown;
let apply: Reply;
const requested: string[] = [];
const posts: unknown[] = [];

const json = ({ status, body }: Reply) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const signedIn = { signed_in: true, login: "newbie", account_id: "acc_1", level: "registered", permissions: ["apply.submit"], quota: { apply_left_today: 3, apply_daily_limit: 3 } };

beforeEach(() => {
  config = { turnstile_site_key: null, pow_difficulty: 1, apply_open: true };
  configMode = "reply";
  me = { signed_in: false };
  apply = { status: 201, body: {} };
  requested.length = 0;
  posts.length = 0;
  // 已经看过宣传片：窗口里不自动播，桌面不去预取播放器分包
  document.cookie = `${PROMO_COOKIE}=1; Path=/`;
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      requested.push(url);
      if (url === "/auth/me") return json({ status: 200, body: me });
      if (url === "/api/public/config") {
        if (configMode === "hang") return new Promise<Response>(() => {});
        if (configMode === "down") throw new TypeError("offline");
        return json({ status: 200, body: config });
      }
      if (url === "/api/portal/apply") {
        posts.push(JSON.parse(String(init?.body)));
        return json(apply);
      }
      return json({ status: 200, body: { signed_in: false } });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  sessionStorage.clear();
  // 点过便签的步骤就记下「看过」（lib/startNote.ts），不清掉的话后面的用例里便签不再出现
  localStorage.clear();
  document.cookie = `${PROMO_COOKIE}=; Max-Age=0; Path=/`;
});

describe("开关怎么读、窗口显示什么", () => {
  it("只有明确写着 false 才算关闭：没有这个字段、读不到配置、旧服务端都按开放", () => {
    expect(applyOpenOf({ apply_open: false })).toBe(false);
    for (const body of [{ apply_open: true }, {}, { turnstile_site_key: null, pow_difficulty: 1 }, null, undefined, "closed", { apply_open: 0 }, { apply_open: "false" }]) {
      expect(applyOpenOf(body), JSON.stringify(body)).toBe(true);
    }
  });

  it("窗口的三种状态：没读到配置是 loading，读到后按开关；寄信时服务端说已关永远是 closed", () => {
    expect(joinView({ loaded: false, open: true, closedByServer: false })).toBe("loading");
    expect(joinView({ loaded: true, open: true, closedByServer: false })).toBe("letter");
    expect(joinView({ loaded: true, open: false, closedByServer: false })).toBe("closed");
    expect(joinView({ loaded: true, open: true, closedByServer: true })).toBe("closed");
  });
});

describe("「加入我们」窗口", () => {
  const nameBox = () => screen.queryByRole("textbox", { name: "姓名" });

  it("关着：整个窗口是关闭页，没有表单，也没有注册、登录、寄出；不去读登录状态；去别的窗口的入口还在", async () => {
    config = { turnstile_site_key: null, pow_difficulty: 1, apply_open: false };
    const onOpen = vi.fn();
    const onApplyOpen = vi.fn();
    const view = render(<JoinBox onOpen={onOpen} onApplyOpen={onApplyOpen} />);

    expect(await screen.findByRole("heading", { name: "招新暂未开放" })).toBeTruthy();
    expect(nameBox()).toBeNull();
    expect(view.container.querySelector("form")).toBeNull();
    expect(screen.queryByRole("button", { name: /寄出这封信/ })).toBeNull();
    expect(screen.queryByRole("link", { name: "注册" })).toBeNull();
    expect(screen.queryByRole("link", { name: "登录" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "先注册再投递" })).toBeNull();
    expect(requested).not.toContain("/auth/me");
    expect(onApplyOpen).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByRole("button", { name: /看宣传片/ }));
    expect(onOpen).toHaveBeenLastCalledWith("promo", expect.any(HTMLElement));
    fireEvent.click(screen.getByRole("button", { name: /关于极客班/ }));
    expect(onOpen).toHaveBeenLastCalledWith("about", expect.any(HTMLElement));
    expect(screen.getByRole("link", { name: /去论坛看看/ }).getAttribute("href")).toBeTruthy();
  });

  it("配置没回来之前只显示加载提示，不先闪出表单也不先闪出关闭页", async () => {
    configMode = "hang";
    me = signedIn;
    const view = render(<JoinBox />);
    await new Promise((done) => setTimeout(done, 20));
    expect(view.container.querySelector(".pt-joinbox")?.textContent).toContain("正在打开信纸");
    expect(nameBox()).toBeNull();
    expect(screen.queryByRole("heading", { name: "招新暂未开放" })).toBeNull();
  });

  it("开着：登录后是信纸；没有 apply_open 字段（旧服务端）同样是信纸；两种都把开放报给桌面", async () => {
    me = signedIn;
    const onApplyOpen = vi.fn();
    const first = render(<JoinBox onApplyOpen={onApplyOpen} />);
    expect(await screen.findByRole("textbox", { name: "姓名" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "招新暂未开放" })).toBeNull();
    expect(onApplyOpen).toHaveBeenLastCalledWith(true);
    first.unmount();

    config = { turnstile_site_key: null, pow_difficulty: 1 };
    onApplyOpen.mockClear();
    render(<JoinBox onApplyOpen={onApplyOpen} />);
    expect(await screen.findByRole("textbox", { name: "姓名" })).toBeTruthy();
    expect(onApplyOpen).toHaveBeenLastCalledWith(true);
  });

  it("寄信时服务端说已经关了（403 apply_closed）：信纸换成关闭页，并报给桌面", async () => {
    me = signedIn;
    apply = { status: 403, body: { error: "apply_closed", message: "招新暂未开放" } };
    const onApplyOpen = vi.fn();
    render(<JoinBox onApplyOpen={onApplyOpen} />);
    fireEvent.change(await screen.findByRole("textbox", { name: "姓名" }), { target: { value: "张同学" } });
    fireEvent.change(screen.getByRole("textbox", { name: "班级" }), { target: { value: "计科 2301 班" } });
    fireEvent.change(screen.getByRole("textbox", { name: /邮箱/ }), { target: { value: "zhang@example.com" } });
    fireEvent.change(screen.getByRole("textbox", { name: /你会什么/ }), { target: { value: "写过一个课程表小程序，想学编译器。" } });
    onApplyOpen.mockClear();

    fireEvent.click(screen.getByRole("button", { name: /寄出这封信/ }));

    expect(await screen.findByRole("heading", { name: "招新暂未开放" })).toBeTruthy();
    expect(posts).toHaveLength(1);
    expect(nameBox()).toBeNull();
    expect(screen.queryByRole("button", { name: /寄出这封信/ })).toBeNull();
    expect(onApplyOpen).toHaveBeenCalledWith(false);
  });

  it("每次打开窗口都重读开关：关着时打开是关闭页，重新开放后再打开是信纸", async () => {
    me = signedIn;
    config = { turnstile_site_key: null, pow_difficulty: 1, apply_open: false };
    const first = render(<JoinBox />);
    expect(await screen.findByRole("heading", { name: "招新暂未开放" })).toBeTruthy();
    first.unmount();

    config = { turnstile_site_key: null, pow_difficulty: 1, apply_open: true };
    render(<JoinBox />);
    expect(await screen.findByRole("textbox", { name: "姓名" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "招新暂未开放" })).toBeNull();
  });

  it("读不到配置：不当成关闭，信纸照常出来并提示连不上服务器，也不往桌面报开关状态", async () => {
    configMode = "down";
    me = signedIn;
    const onApplyOpen = vi.fn();
    render(<JoinBox onApplyOpen={onApplyOpen} />);
    expect(await screen.findByRole("textbox", { name: "姓名" })).toBeTruthy();
    expect((await screen.findByRole("alert")).textContent).toContain("连不上服务器");
    expect(onApplyOpen).not.toHaveBeenCalled();
  });
});

describe("桌面上其它叫人去报名的地方", () => {
  it("visibleApps 关着时只改「加入我们」的说明，应用本身和其它应用都不变", () => {
    const open = visibleApps(false);
    const closed = visibleApps(false, false);
    expect(closed.map((app) => app.id)).toEqual(open.map((app) => app.id));
    const join = (apps: typeof open) => apps.find((app) => app.id === "join")!;
    expect(join(closed).blurb).not.toBe(join(open).blurb);
    expect(join(closed).blurb).not.toMatch(/报名|写封信/);
    expect(closed.filter((app) => app.id !== "join")).toEqual(open.filter((app) => app.id !== "join"));
    // 默认（不传）就是开放，OS_APPS 本身不被改动
    expect(visibleApps(true)).toEqual(OS_APPS);
  });

  const note = () => within(screen.getByRole("complementary", { name: "新来的看这里" }));

  it("便签：开着有「加入我们」一步，关着只剩论坛和代码仓库，开头不再说写封信", () => {
    const view = render(<StartNote onOpen={() => {}} onClose={() => {}} />);
    expect(note().getByRole("button", { name: /在「加入我们」写封信/ })).toBeTruthy();
    expect(note().getAllByRole("listitem")).toHaveLength(3);
    view.unmount();

    render(<StartNote onOpen={() => {}} onClose={() => {}} applyOpen={false} />);
    expect(note().queryByRole("button", { name: /加入我们/ })).toBeNull();
    expect(note().getAllByRole("listitem")).toHaveLength(2);
    expect(note().getByRole("button", { name: /论坛/ })).toBeTruthy();
    expect(note().getByRole("button", { name: /代码仓库/ })).toBeTruthy();
    expect(note().queryByText(/写封信/)).toBeNull();
  });

  function renderDesktop() {
    const view = render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<YugcOs />} />
        </Routes>
      </MemoryRouter>,
    );
    const icon = (id: string) => view.container.querySelector<HTMLElement>(`.pt-icons [data-cta="${id}"]`)!;
    const openAbout = () => {
      fireEvent.click(screen.getByRole("button", { name: "系统菜单" }));
      fireEvent.click(screen.getByRole("menuitem", { name: "关于极客班" }));
      return within(screen.getByRole("dialog", { name: "关于极客班" }));
    };
    return { ...view, icon, openAbout };
  }

  it("开着：图标说明、便签、「关于」窗口都照旧", async () => {
    const { icon, openAbout } = renderDesktop();
    await waitFor(() => expect(requested).toContain("/api/public/config"));
    expect(icon("join").title).toBe(OS_APPS.find((app) => app.id === "join")!.blurb);
    expect(note().getByRole("button", { name: /在「加入我们」写封信/ })).toBeTruthy();
    expect(openAbout().getByRole("button", { name: /加入我们/ })).toBeTruthy();
  });

  it("关着：图标说明、便签、「关于」窗口都不再叫人去报名；「加入我们」还在，打开是关闭页", async () => {
    config = { turnstile_site_key: null, pow_difficulty: 1, apply_open: false };
    const { icon, openAbout } = renderDesktop();
    await waitFor(() => expect(icon("join").title).toBe(visibleApps(false, false).find((app) => app.id === "join")!.blurb));
    expect(note().queryByRole("button", { name: /加入我们/ })).toBeNull();
    expect(note().queryByText(/写封信/)).toBeNull();

    const about = openAbout();
    expect(about.queryByRole("button", { name: /加入我们/ })).toBeNull();
    expect(about.queryByText(/写封信/)).toBeNull();
    fireEvent.click(within(screen.getByRole("dialog", { name: "关于极客班" })).getByRole("button", { name: "关闭" }));

    fireEvent.click(within(screen.getByRole("navigation", { name: "Dock" })).getByRole("button", { name: "加入我们" }));
    const join = within(screen.getByRole("dialog", { name: "加入我们" }));
    expect(await join.findByRole("heading", { name: "招新暂未开放" })).toBeTruthy();
    expect(join.queryByRole("textbox", { name: "姓名" })).toBeNull();
  });

  it("桌面读到的是开放、窗口打开时读到已关闭：桌面上的说明跟着变", async () => {
    const { icon } = renderDesktop();
    await waitFor(() => expect(requested).toContain("/api/public/config"));
    await new Promise((done) => setTimeout(done, 20));
    const openBlurb = OS_APPS.find((app) => app.id === "join")!.blurb;
    expect(icon("join").title).toBe(openBlurb);

    config = { turnstile_site_key: null, pow_difficulty: 1, apply_open: false };
    fireEvent.click(within(screen.getByRole("navigation", { name: "Dock" })).getByRole("button", { name: "加入我们" }));
    expect(await within(screen.getByRole("dialog", { name: "加入我们" })).findByRole("heading", { name: "招新暂未开放" })).toBeTruthy();
    await waitFor(() => expect(icon("join").title).not.toBe(openBlurb));
    expect(note().queryByRole("button", { name: /加入我们/ })).toBeNull();
  });
});
