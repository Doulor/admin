// @vitest-environment jsdom
// 桌面换肤（#275，SPEC §4.2）：默认壁纸「晴空」接着开机动画的最后一帧画（极客娘的位置算法相同，手机竖屏再滑到图标下面）；
// 菜单栏是 YUGC 四色标志、搜索、时间、28px 头像；图标和 Dock 的底色在 YUGC 四个字母色里轮换；
// 窗口标题栏三个圆点各有 44×44 的点击区域、标题居中，打开时缩放加淡入，减少动态效果时只淡入。
// jsdom 没有 canvas：「晴空」换成记下参数的空元素，画面本身由主会话在真浏览器里验收。
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SkyScene } from "../../app/web/sites/portal/components/os/SkyWallpaper";

const sky = vi.hoisted(() => ({ scenes: [] as SkyScene[] }));
vi.mock("../../app/web/sites/portal/components/os/SkyWallpaper", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../app/web/sites/portal/components/os/SkyWallpaper")>()),
  default: (scene: SkyScene) => {
    sky.scenes.push(scene);
    return <div data-testid="sky" />;
  },
  SkyThumb: () => <canvas />,
}));
vi.mock("../../app/web/sites/portal/components/PromoLazy", () => ({ LazyPromoPlayer: () => null }));
vi.mock("../../app/web/sites/portal/lib/wallpapers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../app/web/sites/portal/lib/wallpapers")>()),
  prefetchWallpapersWhenIdle: () => () => undefined,
}));

import YugcOs from "../../app/web/sites/portal/components/os/YugcOs";
import { skyFigure } from "../../app/web/sites/portal/components/os/SkyWallpaper";
import { bootLayout } from "../../app/web/sites/portal/components/boot/layout";
import { OS_APPS, appTone } from "../../app/web/sites/portal/lib/osApps";

// jsdom 环境里 import.meta.url 不是 file: 地址，按仓库根（vitest 的工作目录）读
const OS_CSS = readFileSync(`${process.cwd()}/app/web/sites/portal/styles/os.css`, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const ASPECT = 883 / 1676;
const NO_INSETS = { top: 0, bottom: 0 };

describe("「晴空」壁纸里极客娘的位置", () => {
  it("横屏：和开机动画最后一帧同一个位置，有没有主屏区间、滑没滑都一样", () => {
    const boot = bootLayout(1440, 900, ASPECT).fig;
    expect(skyFigure(1440, 900, ASPECT, NO_INSETS, null, 1)).toEqual(boot);
    expect(skyFigure(1440, 900, ASPECT, NO_INSETS, { top: 400, bottom: 800 }, 1)).toEqual(boot);
  });

  it("手机竖屏：滑之前在开机动画的位置（算上安全区）；滑完底边对齐区间下沿、水平居中，没有区间时不动", () => {
    const insets = { top: 47, bottom: 34 };
    const boot = bootLayout(390, 844, ASPECT, insets.top, insets.bottom).fig;
    const band = { top: 460, bottom: 690 };
    expect(skyFigure(390, 844, ASPECT, insets, band, 0)).toEqual(boot);
    expect(skyFigure(390, 844, ASPECT, insets, null, 1)).toEqual(boot);
    const home = skyFigure(390, 844, ASPECT, insets, band, 1).girl;
    expect(home.y + home.h * 0.95).toBeCloseTo(band.bottom, 6);
    expect(home.x + home.w / 2).toBeCloseTo(195, 6);
    expect(home.h * 0.95).toBeCloseTo(band.bottom - band.top, 6);
    // 区间太矮时至少 150px 高，不缩成一个点
    const tight = skyFigure(390, 844, ASPECT, insets, { top: 640, bottom: 690 }, 1).girl;
    expect(tight.h * 0.95).toBeCloseTo(150, 6);
  });
});

let phone = false;
beforeEach(() => {
  phone = false;
  sky.scenes = [];
  document.cookie = "yugc_promo_seen=1; Path=/";
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.startsWith("(max-width: 860px)") ? phone : query === "(orientation: portrait)" && phone,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ signed_in: false }), { status: 200, headers: { "content-type": "application/json" } })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

function mount(boot: { epoch: number; settled: boolean } | null = null) {
  return render(
    <MemoryRouter>
      <YugcOs boot={boot} />
    </MemoryRouter>,
  );
}

describe("桌面", () => {
  it("默认壁纸是「晴空」，铺在整个外壳上（菜单栏底下也是它）；刚播完开机动画时拿到它的起点", () => {
    const { container, rerender } = mount({ epoch: 12.5, settled: false });
    const wall = container.querySelector<HTMLElement>(".pt-wall")!;
    expect(wall.dataset.wallpaper).toBe("sky");
    expect(wall.closest(".pt-walls")?.parentElement).toBe(container.querySelector(".pt-os-shell"));
    expect(sky.scenes.at(-1)).toMatchObject({ epoch: 12.5, settled: false, band: null });
    rerender(
      <MemoryRouter>
        <YugcOs boot={{ epoch: 12.5, settled: true }} />
      </MemoryRouter>,
    );
    expect(sky.scenes.at(-1)).toMatchObject({ epoch: 12.5, settled: true });
  });

  it("没播开机动画直接进桌面：没有起点，一开始就在最终位置", () => {
    mount();
    expect(sky.scenes.at(-1)).toMatchObject({ epoch: null, settled: true });
  });

  it("手机竖屏把图标下沿到搜索框上沿量出来交给壁纸；电脑上不给", () => {
    const rect = (top: number, bottom: number) => ({ top, bottom, left: 0, right: 0, width: 0, height: bottom - top, x: 0, y: top, toJSON() {} }) as DOMRect;
    const spy = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      if (this.classList.contains("pt-icons")) return rect(120, 440);
      if (this.classList.contains("pt-phone-search")) return rect(700, 744);
      return rect(0, 0);
    });
    phone = true;
    mount();
    expect(sky.scenes.at(-1)?.band).toEqual({ top: 452, bottom: 696 });
    cleanup();
    phone = false;
    mount();
    expect(sky.scenes.at(-1)?.band).toBeNull();
    spy.mockRestore();
  });

  it("菜单栏：左边 YUGC 四色标志打开系统菜单，右边搜索、时间、头像；没登录时头像打开资料卡，里面去统一登录页", async () => {
    mount();
    const bar = within(screen.getByRole("banner", { name: "菜单栏" }));
    const logo = bar.getByRole("button", { name: "系统菜单" });
    expect([...logo.querySelectorAll("[data-tone]")].map((letter) => [letter.textContent, letter.getAttribute("data-tone")])).toEqual([["Y", "y"], ["U", "u"], ["G", "g"], ["C", "c"]]);
    fireEvent.click(logo);
    expect(screen.getByRole("menuitem", { name: "关于极客班" })).not.toBeNull();
    expect(bar.getByRole("button", { name: /搜索/ })).not.toBeNull();
    const avatar = await bar.findByRole("button", { name: "登录或注册" });
    expect(avatar.getAttribute("aria-haspopup")).toBe("dialog");
    expect(avatar.querySelector(".pt-avatar")).not.toBeNull();
    // 头像在最右边
    expect(avatar.parentElement?.lastElementChild).toBe(avatar);
    fireEvent.click(avatar);
    const card = within(screen.getByRole("dialog", { name: "登录极客班" }));
    expect(card.getByRole("link", { name: "登录" }).getAttribute("href")).toBe(`/signin?return_to=${encodeURIComponent("/")}`);
  });

  it("登录后头像换成账号按钮，有头像图就显示图", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ signed_in: true, login: "nano", user_id: 7, avatar_url: "/a.webp" }), { status: 200, headers: { "content-type": "application/json" } })));
    mount();
    const avatar = await screen.findByRole("button", { name: "账号：nano" });
    expect(avatar.querySelector("img")?.getAttribute("src")).toBe("/a.webp");
  });

  it("图标底色按应用清单的顺序在 Y/U/G/C 里轮换，桌面和 Dock 上同一个应用颜色一样", () => {
    expect(OS_APPS.slice(0, 5).map(appTone)).toEqual(["y", "u", "g", "c", "y"]);
    mount();
    const desk = within(screen.getByRole("list", { name: "桌面上的应用" }));
    const dock = within(screen.getByRole("navigation", { name: "Dock" }));
    for (const app of OS_APPS.filter((item) => item.id !== "console")) {
      const tone = desk.getByRole("button", { name: new RegExp(app.name) }).querySelector(".pt-glyph")?.getAttribute("data-tone");
      expect(tone, app.id).toBe(appTone(app));
      expect(dock.getByRole("button", { name: new RegExp(app.name) }).querySelector(".pt-glyph")?.getAttribute("data-tone"), app.id).toBe(tone);
    }
  });

  it("壁纸面板第一项是「晴空」，缩略图是画出来的", () => {
    mount();
    fireEvent.keyDown(within(screen.getByRole("list", { name: "桌面上的应用" })).getByRole("button", { name: "壁纸" }), { key: "Enter" });
    const choices = screen.getAllByRole("radio");
    expect(choices.map((choice) => choice.textContent)).toEqual(["晴空", "极客娘 1", "极客娘 2"]);
    expect(choices[0].getAttribute("aria-checked")).toBe("true");
    expect(choices[0].querySelector("canvas")).not.toBeNull();
  });
});

describe("窗口外框", () => {
  it("标题栏：三个圆点按钮（关闭、最小化、放大），标题在中间，左右两栏一样宽", () => {
    mount();
    fireEvent.keyDown(within(screen.getByRole("list", { name: "桌面上的应用" })).getByRole("button", { name: "关于极客班" }), { key: "Enter" });
    const win = screen.getByRole("dialog", { name: "关于极客班" });
    const bar = win.querySelector(".pt-win-bar")!;
    expect([...bar.querySelectorAll(".pt-win-lights button")].map((button) => button.getAttribute("aria-label"))).toEqual(["关闭", "最小化", "放大"]);
    expect(bar.querySelector("b")?.textContent).toBe("关于极客班");
    expect(OS_CSS).toMatch(/\.pt-win-bar \{[^}]*grid-template-columns: 132px minmax\(0, 1fr\) 132px;/);
  });

  it("样式：圆点 12px、按钮 44×44；窗口圆角、粉色描边、标题栏粉色渐变都取令牌；打开 220ms 缩放加淡入，减少动态效果只淡入", () => {
    expect(OS_CSS).toMatch(/\.pt-win-lights button \{[^}]*width: 44px; height: 44px;/);
    expect(OS_CSS).toMatch(/\.pt-win-lights i \{[^}]*width: 12px; height: 12px;/);
    expect(OS_CSS).toMatch(/\.pt-win \{[^}]*border: 1px solid var\(--os-win-border\); border-radius: var\(--os-radius-win\); background: var\(--os-panel\);/);
    expect(OS_CSS).toMatch(/\.pt-win-bar \{[^}]*background: linear-gradient\(var\(--os-win-top\), var\(--os-win-bottom\)\);/);
    expect(OS_CSS).toMatch(/animation: pt-win-in \.22s var\(--pt-ease\);/);
    expect(OS_CSS).toContain("@keyframes pt-win-in { from { opacity: 0; transform: scale(.96); } }");
    const reduced = OS_CSS.split("@media (prefers-reduced-motion: reduce)").slice(1).join("\n");
    expect(reduced).toContain(".pt-os-shell .pt-win { animation-name: pt-win-fade-in; animation-duration: .22s !important; }");
  });

  it("Dock 悬停上浮 6px；菜单栏、Dock、窗口都是半透明白加 16px 模糊", () => {
    expect(OS_CSS).toContain(".pt-dk:hover, .pt-dk:focus-visible { transform: translateY(-6px); outline: none; }");
    for (const selector of [".pt-mb", ".pt-dock", ".pt-win"]) {
      const rule = OS_CSS.match(new RegExp(`\\n${selector.replace(".", "\\.")} \\{([^}]*)\\}`))?.[1] ?? "";
      expect(rule, selector).toContain("background: var(--os-panel)");
      expect(rule, selector).toContain("backdrop-filter: blur(16px)");
    }
  });
});
