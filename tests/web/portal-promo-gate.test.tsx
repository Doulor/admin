// @vitest-environment jsdom
// #122 的窗口版（#284）：第一次打开「加入我们」（没有 cookie、没有预取）时自动弹出的宣传片窗口，播放器分包在弱网下要几秒才到。
// 这几秒窗口里要有加载提示，右上角（手机上是面板上）的关闭一直能用；信纸不用等它，也没有遮住整个页面；
// 关闭的语义和播放开始时一样：自动弹的这一次写「已看过」的 cookie。分包到了以后窗口不重开，里面换成真正的播放器。
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as PromoLib from "../../app/web/sites/portal/lib/promo";
import { PROMO_COOKIE } from "../../app/web/sites/portal/lib/promo";
import { PHONE_QUERY } from "../../app/web/sites/portal/lib/useMediaQuery";

// 播放器分包由用例决定什么时候到：不放行就停在 Suspense 的 fallback 上（真实弱网里下载分包的那几秒）。
// 放行后给真正的播放器；loads 记分包被下载了几次。每条用例重新登记这个桩：vitest 会把放行过的桩结果缓存下来，不重新登记，后面的用例就拿到现成的播放器。
const PLAYER = "../../app/web/sites/portal/components/PromoPlayer";
const chunk = vi.hoisted(() => ({ loads: 0, arrive: () => {} }));
// 真正的播放器挂上以后停在「正在加载」：能力探测不返回，不去碰 hls.js 和片源
vi.mock("../../app/web/sites/portal/lib/promo", async (importOriginal) => ({
  ...(await importOriginal<typeof PromoLib>()),
  detectCapabilities: () => new Promise(() => {}),
}));
vi.mock("../../app/web/sites/portal/components/os/Wallpaper", () => ({ default: () => null }));
vi.mock("../../app/web/sites/portal/lib/wallpapers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../app/web/sites/portal/lib/wallpapers")>()),
  prefetchWallpapersWhenIdle: () => () => undefined,
}));

let YugcOs: typeof import("../../app/web/sites/portal/components/os/YugcOs").default;
const env = { phone: false, reduced: false };
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
const signedIn = { signed_in: true, login: "newbie", account_id: "acc_1", level: "registered", permissions: ["apply.submit"], quota: { apply_left_today: 3, apply_daily_limit: 3 } };

beforeEach(async () => {
  // 每条用例一份新的模块：PromoLazy 记着上一次加载的播放器，分包也要重新「下载」
  vi.resetModules();
  chunk.loads = 0;
  vi.doMock(PLAYER, async (importOriginal: () => Promise<unknown>) => {
    chunk.loads += 1;
    await new Promise<void>((resolve) => (chunk.arrive = resolve));
    return importOriginal();
  });
  env.phone = false;
  env.reduced = false;
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  Element.prototype.scrollTo ??= () => undefined;
  // 桌面空闲后的预取不是这里要测的
  vi.stubGlobal("requestIdleCallback", () => 0);
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      if (query === PHONE_QUERY || query === "(orientation: portrait)") return env.phone;
      return query === "(prefers-reduced-motion: reduce)" && env.reduced;
    },
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.stubGlobal("fetch", vi.fn(async (url: string) => json(url === "/api/public/config" ? { turnstile_site_key: null, pow_difficulty: 1, apply_open: true } : url === "/auth/me" ? signedIn : { signed_in: false })));
  // 播放器的背景画布与视频：jsdom 没有实现
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  // 每个用例从「没看过」开始
  document.cookie = `${PROMO_COOKIE}=; Max-Age=0; Path=/`;
  ({ default: YugcOs } = await import("../../app/web/sites/portal/components/os/YugcOs"));
});
afterEach(() => {
  cleanup();
  vi.doUnmock(PLAYER);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  sessionStorage.clear();
  localStorage.clear();
  document.cookie = `${PROMO_COOKIE}=; Max-Age=0; Path=/`;
});

const dock = () => within(screen.getByRole("navigation", { name: "Dock" }));
const seen = () => document.cookie.includes(`${PROMO_COOKIE}=1`);
const promo = () => screen.queryByRole("dialog", { name: "宣传片" });
function mount() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<YugcOs />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("宣传片加载占位（#122）", () => {
  it("分包没到时窗口里显示加载提示，信纸照常能用；关闭可点，关掉算看过；分包之后才到也不会再冒出来", async () => {
    mount();
    fireEvent.click(dock().getByRole("button", { name: "加入我们" }));

    // 分包没到，占位顶上：窗口在，加载提示在，窗口自己的关闭按钮可点
    const window = await screen.findByRole("dialog", { name: "宣传片" });
    expect(within(window).getByText("正在加载…")).toBeTruthy();
    const close = within(window).getByRole("button", { name: "关闭" });
    expect(close.hasAttribute("disabled")).toBe(false);
    await waitFor(() => expect(chunk.loads).toBe(1));

    // 信纸不用等它，也没有被遮住
    const join = screen.getByRole("dialog", { name: "加入我们" });
    expect(await within(join).findByRole("textbox", { name: "姓名" })).toBeTruthy();
    expect(join.inert).toBe(false);
    expect(seen()).toBe(false);

    fireEvent.click(close);

    // 与开始播放同一语义：写「已看过」的 cookie，窗口收起来
    expect(seen()).toBe(true);
    expect(promo()).toBeNull();
    expect(screen.getByRole("dialog", { name: "加入我们" })).toBeTruthy();

    await act(async () => chunk.arrive());
    expect(promo()).toBeNull();
    expect(document.querySelector("video")).toBeNull();
  });

  it("Esc 同样能关", async () => {
    mount();
    fireEvent.click(dock().getByRole("button", { name: "加入我们" }));
    await screen.findByRole("dialog", { name: "宣传片" });

    fireEvent.keyDown(document.body, { key: "Escape" });

    expect(seen()).toBe(true);
    expect(promo()).toBeNull();
    expect(screen.getByRole("dialog", { name: "加入我们" })).toBeTruthy();
  });

  it("手机上同样：底部面板里有加载提示和「关闭应用」，关掉露出下面的「加入我们」", async () => {
    env.phone = true;
    mount();
    fireEvent.click(within(screen.getByRole("list", { name: "主屏幕上的应用" })).getByRole("button", { name: "加入我们" }));

    const sheet = await screen.findByRole("dialog", { name: "宣传片" });
    expect(within(sheet).getByText("正在加载…")).toBeTruthy();
    fireEvent.click(within(sheet).getByRole("button", { name: "关闭应用" }));

    expect(promo()).toBeNull();
    expect(seen()).toBe(true);
    expect(screen.getByRole("dialog", { name: "加入我们" })).toBeTruthy();
  });

  it("自己从桌面点开重看：同样有加载提示和关闭；关掉不写看过", async () => {
    mount();
    fireEvent.click(dock().getByRole("button", { name: "宣传片" }));

    const window = screen.getByRole("dialog", { name: "宣传片" });
    expect(await within(window).findByText("正在加载…")).toBeTruthy();
    fireEvent.click(within(window).getByRole("button", { name: "关闭" }));

    expect(promo()).toBeNull();
    expect(seen()).toBe(false);
  });

  it("减少动态效果：不弹窗口、不下载播放器分包，按看过算，直接进信纸", async () => {
    env.reduced = true;
    mount();
    fireEvent.click(dock().getByRole("button", { name: "加入我们" }));

    // 和原来一样：写「已看过」的 cookie，信纸一开始就能操作
    await waitFor(() => expect(seen()).toBe(true));
    expect(await within(screen.getByRole("dialog", { name: "加入我们" })).findByRole("textbox", { name: "姓名" })).toBeTruthy();
    expect(promo()).toBeNull();
    expect(screen.queryByText("正在加载…")).toBeNull();
    expect(chunk.loads).toBe(0);
  });

  it("分包到了换成播放器：还是这个窗口，不重开，分包也只下载一次", async () => {
    mount();
    fireEvent.click(dock().getByRole("button", { name: "加入我们" }));
    const window = await screen.findByRole("dialog", { name: "宣传片" });
    expect(window.querySelector("video")).toBeNull();
    await waitFor(() => expect(chunk.loads).toBe(1));

    await act(async () => chunk.arrive());

    await waitFor(() => expect(window.querySelector("video")).not.toBeNull());
    expect(screen.getByRole("dialog", { name: "宣传片" })).toBe(window);
    expect(window.querySelector(".pt-promo-ambient")).not.toBeNull();
    expect(chunk.loads).toBe(1);
    // 播放器接手后窗口照样能关
    fireEvent.click(within(window).getByRole("button", { name: "关闭" }));
    expect(promo()).toBeNull();
    expect(document.querySelector("video")).toBeNull();
  });
});
