// @vitest-environment jsdom
// 首页进站流程（#275，SPEC §4.1）：按北京日期判断今天播没播过开机动画、减少动态效果直接进桌面、?boot=1 强制重播且不改记录；
// 就绪后先停一下再淡出开机动画层、露出桌面。开机动画（canvas）和桌面在这里换成假组件，只看首页怎么调度它们。
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../app/web/sites/portal/components/boot/BootSequence", () => ({
  default: ({ onReady }: { onReady: (info: { epoch: number; skipped: boolean }) => void }) => (
    <button type="button" onClick={() => onReady({ epoch: 42.5, skipped: true })}>
      假开机动画
    </button>
  ),
}));
vi.mock("../../app/web/sites/portal/components/os/YugcOs", () => ({
  default: ({ onReplayBoot, boot }: { onReplayBoot?: () => void; boot?: { epoch: number; settled: boolean } | null }) => (
    <div data-testid="desktop" data-boot={JSON.stringify(boot ?? null)}>
      <button type="button" data-cta="join">
        加入我们
      </button>
      <button type="button" onClick={onReplayBoot}>
        重播开机动画
      </button>
    </div>
  ),
}));
// 首页会先下用户选的图片壁纸；jsdom 的 Image 没有 decode()
vi.mock("../../app/web/sites/portal/lib/wallpapers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../app/web/sites/portal/lib/wallpapers")>()),
  loadWallpaperImage: async () => undefined,
}));

import Home from "../../app/web/sites/portal/pages/Home";
import { BOOT_DAY_KEY, beijingDay, bootMobile, forcedReplay, shouldPlayBoot } from "../../app/web/sites/portal/lib/bootGate";
import { particleBudget } from "../../app/web/sites/portal/components/boot/timeline";
import { flushEvents, reportEvent } from "../../app/web/sites/portal/lib/events";

let reducedMotion = false;
beforeEach(() => {
  reducedMotion = false;
  localStorage.clear();
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: reducedMotion && query.includes("reduce"), media: query, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("播不播开机动画", () => {
  it("北京时间的日期：UTC 15:59 还是当天，16:00 已经是第二天", () => {
    expect(beijingDay(new Date("2026-10-24T15:59:59Z"))).toBe("2026-10-24");
    expect(beijingDay(new Date("2026-10-24T16:00:00Z"))).toBe("2026-10-25");
    expect(beijingDay(new Date("2026-12-31T16:30:00Z"))).toBe("2027-01-01");
  });

  it("今天播过不再播，第二天再播；从没播过要播", () => {
    expect(shouldPlayBoot({ playedDay: "2026-10-24", today: "2026-10-24", reducedMotion: false, force: false })).toBe(false);
    expect(shouldPlayBoot({ playedDay: "2026-10-24", today: "2026-10-25", reducedMotion: false, force: false })).toBe(true);
    expect(shouldPlayBoot({ playedDay: null, today: "2026-10-24", reducedMotion: false, force: false })).toBe(true);
  });

  it("减少动态效果一律不播，?boot=1 也不例外；?boot=1 在今天播过时强制重播", () => {
    expect(shouldPlayBoot({ playedDay: null, today: "2026-10-24", reducedMotion: true, force: false })).toBe(false);
    expect(shouldPlayBoot({ playedDay: null, today: "2026-10-24", reducedMotion: true, force: true })).toBe(false);
    expect(shouldPlayBoot({ playedDay: "2026-10-24", today: "2026-10-24", reducedMotion: false, force: true })).toBe(true);
    expect(forcedReplay("?boot=1")).toBe(true);
    expect(forcedReplay("?boot=0")).toBe(false);
    expect(forcedReplay("?x=1&boot=1")).toBe(true);
    expect(forcedReplay("")).toBe(false);
  });

  it("手机版还是电脑版：宽度小于 768 或竖屏用手机版（SPEC §4.1）", () => {
    expect(bootMobile(390, 844)).toBe(true);
    expect(bootMobile(360, 780)).toBe(true);
    expect(bootMobile(700, 500)).toBe(true);
    expect(bootMobile(800, 900)).toBe(true);
    expect(bootMobile(768, 768)).toBe(true);
    expect(bootMobile(1440, 900)).toBe(false);
    expect(bootMobile(1024, 700)).toBe(false);
  });

  it("粒子数量：手机基数是桌面的一半，核心少、3 倍屏都会再收，画面面积超出上限不再加", () => {
    const desk = { mobile: false, width: 1440, height: 900, dpr: 2, cores: 8 };
    expect(particleBudget(desk)).toBe(Math.round(14000 * ((1440 * 900) / 1296000)));
    expect(particleBudget({ ...desk, cores: 2 })).toBe(Math.round(particleBudget(desk) / 2));
    expect(particleBudget({ ...desk, dpr: 3 })).toBeLessThan(particleBudget(desk));
    expect(particleBudget({ ...desk, width: 5120, height: 2880 })).toBe(Math.round(14000 * 1.4));
    expect(particleBudget({ mobile: true, width: 390, height: 844, dpr: 3, cores: 6 })).toBeLessThan(7000);
  });
});

function renderHome(search = "") {
  window.history.replaceState(null, "", `/${search}`);
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  );
}

describe("首页进站", () => {
  it("今天播过：直接进桌面，不加载开机动画", async () => {
    localStorage.setItem(BOOT_DAY_KEY, beijingDay());
    const { container } = renderHome();
    expect(await screen.findByTestId("desktop")).not.toBeNull();
    expect(screen.queryByText("假开机动画")).toBeNull();
    expect(container.querySelector(".pt-desktop-layer.is-entering")).not.toBeNull();
    // 没播开机动画：壁纸不用接最后一帧
    expect(screen.getByTestId("desktop").dataset.boot).toBe("null");
  });

  it("开了减少动态效果：没播过也直接进桌面", async () => {
    reducedMotion = true;
    renderHome();
    expect(await screen.findByTestId("desktop")).not.toBeNull();
    expect(screen.queryByText("假开机动画")).toBeNull();
    expect(localStorage.getItem(BOOT_DAY_KEY)).toBeNull();
  });

  it("没播过：先播；就绪时记下今天，桌面挂在底下且不可操作，停一下后开机动画层淡出、卸掉，焦点进桌面", async () => {
    const { container } = renderHome();
    fireEvent.click(await screen.findByText("假开机动画"));
    expect(localStorage.getItem(BOOT_DAY_KEY)).toBe(beijingDay());
    const layer = container.querySelector<HTMLElement>(".pt-desktop-layer");
    expect(layer?.inert).toBe(true);
    expect(container.querySelector(".pt-desktop-layer.is-entering")).toBeNull();
    // 桌面的「晴空」壁纸拿到开机动画的起点，开机动画层还在上面时不动
    expect(JSON.parse((await screen.findByTestId("desktop")).dataset.boot ?? "null")).toEqual({ epoch: 42.5, settled: false });
    await waitFor(() => expect(container.querySelector(".pt-boot-layer.is-leaving")).not.toBeNull());
    await waitFor(() => expect(container.querySelector(".pt-boot-layer")).toBeNull());
    expect(layer?.inert).toBe(false);
    expect(JSON.parse(screen.getByTestId("desktop").dataset.boot ?? "null")).toEqual({ epoch: 42.5, settled: true });
    expect(document.activeElement?.getAttribute("data-cta")).toBe("join");
  });

  it("?boot=1：今天播过也重播，播完不改记录", async () => {
    localStorage.setItem(BOOT_DAY_KEY, "2026-01-01");
    renderHome("?boot=1");
    fireEvent.click(await screen.findByText("假开机动画"));
    expect(localStorage.getItem(BOOT_DAY_KEY)).toBe("2026-01-01");
  });

  it("桌面菜单里的「重播开机动画」：卸掉桌面重播一遍，同样不改记录", async () => {
    localStorage.setItem(BOOT_DAY_KEY, beijingDay());
    renderHome();
    fireEvent.click(await screen.findByText("重播开机动画"));
    expect(await screen.findByText("假开机动画")).not.toBeNull();
    expect(screen.queryByTestId("desktop")).toBeNull();
    localStorage.setItem(BOOT_DAY_KEY, "2026-01-01");
    fireEvent.click(screen.getByText("假开机动画"));
    expect(localStorage.getItem(BOOT_DAY_KEY)).toBe("2026-01-01");
  });
});

describe("前端埋点", () => {
  it("攒成一批发 POST /api/events，满 20 条立刻发；失败不抛错", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => {
      throw new Error("offline");
    });
    vi.stubGlobal("fetch", fetchMock);
    reportEvent("os.boot.played", { meta: { mobile: false } });
    reportEvent("os.app.open", { target_type: "app", target_id: "join" });
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/events");
    expect(JSON.parse(String(init.body))).toEqual({ events: [{ action: "os.boot.played", meta: { mobile: false } }, { action: "os.app.open", target_type: "app", target_id: "join" }] });
    for (let i = 0; i < 20; i++) reportEvent("os.app.open", { target_id: String(i) });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String((fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].body)).events).toHaveLength(20);
    flushEvents();
    vi.useRealTimers();
  });
});
