// @vitest-environment jsdom
// 宣传片播放器（桌面「宣传片」窗口的正文，#284 以前是全屏层）的交互：画面上没有按钮（#142）、点画面不暂停、只记一次「看过」、
// 浏览器不让自动播时的退路（停在封面，点画面播）、播不了时在画面上说明、窗口收起就暂停露出来接着播、卸载（关窗口）停止播放并释放片源。
// 关闭、最小化、Esc 是桌面窗口的事（tests/web/portal-promo-window.test.tsx）。
// jsdom 没有 MediaSource、视频解码与 canvas：能力探测用桩，video.play/pause/load 用桩，canvas 的 2D 上下文返回 null（不画背景），
// hls.js 换成记录调用的假对象，片源只核对地址。
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Capabilities } from "../../app/web/sites/portal/lib/promo";

const caps = vi.hoisted(() => ({ current: { mse: false, mseAv1Smooth: false, native: true, nativeAv1: false, touch: false } as Capabilities }));
const fakeHls = vi.hoisted(() => {
  type Handler = (...args: unknown[]) => void;
  class FakeHls {
    static Events = { MANIFEST_PARSED: "manifestParsed", ERROR: "error" };
    static ErrorTypes = { MEDIA_ERROR: "mediaError" };
    static last: FakeHls | null = null;
    handlers = new Map<string, Handler>();
    levels = [3660452, 343186, 1227252, 641540, 2151112].map((bitrate) => ({ bitrate }));
    startLevel = -1;
    started: number | null = null;
    /** startLoad 被调用那一刻的 startLevel：起播档必须在开始加载之前设好 */
    levelAtStart: number | null = null;
    source = "";
    destroyed = false;
    constructor(public config: Record<string, unknown>) {
      FakeHls.last = this;
    }
    on(event: string, handler: Handler) {
      this.handlers.set(event, handler);
    }
    loadSource(url: string) {
      this.source = url;
    }
    attachMedia() {}
    startLoad(position: number) {
      this.started = position;
      this.levelAtStart = this.startLevel;
    }
    recoverMediaError() {}
    destroy() {
      this.destroyed = true;
    }
  }
  return FakeHls;
});
// hls.js 只装在 app/web 下，从测试文件解析不到 "hls.js/light"：按播放器实际加载的文件路径换掉它
vi.mock("../../app/web/node_modules/hls.js/dist/hls.light.mjs", () => ({ default: fakeHls }));
vi.mock("../../app/web/sites/portal/lib/promo", async (original) => ({
  ...(await original<typeof import("../../app/web/sites/portal/lib/promo")>()),
  detectCapabilities: vi.fn(async () => caps.current),
}));

import PromoPlayer from "../../app/web/sites/portal/components/PromoPlayer";
import { PROMO, detectCapabilities } from "../../app/web/sites/portal/lib/promo";
import { PROMO_FAILED, PROMO_UNSUPPORTED } from "../../app/web/sites/portal/lib/promoWindow";

let play: ReturnType<typeof vi.fn>;
beforeEach(() => {
  caps.current = { mse: false, mseAv1Smooth: false, native: true, nativeAv1: false, touch: false };
  fakeHls.last = null;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }));
  play = vi.fn(async () => {});
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(play as () => Promise<void>);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
});
afterEach(() => {
  // 先卸载（卸载时会调 video.load()），再还原桩
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const video = () => document.querySelector("video") as HTMLVideoElement;
const root = () => document.querySelector(".pt-promo") as HTMLElement;
const notAllowed = () => new DOMException("blocked", "NotAllowedError");
/** jsdom 的指针事件不带 pointerType：自己造一个带上它的事件 */
function pointer(target: Element, type: "pointerdown" | "pointermove", pointerType: "mouse" | "touch") {
  const event = new MouseEvent(type, { bubbles: true });
  Object.defineProperty(event, "pointerType", { value: pointerType });
  act(() => {
    target.dispatchEvent(event);
  });
}
/** 让桩出来的 video.paused 跟着真实浏览器走：play() 之后是 false，pause 事件之后是 true */
function trackPaused() {
  let paused = true;
  Object.defineProperty(video(), "paused", { configurable: true, get: () => paused });
  return (value: boolean) => (paused = value);
}
/** 画面上没有任何按钮：没有播放 / 暂停、进度、时间、音量、「打开声音」「播放宣传片」，也没有「跳过」「关闭」（那是窗口标题栏的事） */
function expectNoControls() {
  expect(within(root()).queryAllByRole("button")).toEqual([]);
  expect(within(root()).queryAllByRole("slider")).toEqual([]);
  expect(within(root()).queryAllByRole("progressbar")).toEqual([]);
  expect(root().textContent).not.toMatch(/\d:\d\d|打开声音|播放宣传片|静音|暂停|跳过|关闭/);
}

it("原生 HLS 播 H.264 片源，带声音自动播；画面上没有按钮；真正开始播放时记一次看过", async () => {
  const onEnd = vi.fn();
  const onSeen = vi.fn();
  render(<PromoPlayer onSeen={onSeen} onEnd={onEnd} />);
  await waitFor(() => expect(video().getAttribute("src")).toBe(PROMO.masters.h264));
  expect(root().dataset.engine).toBe("native");
  expect(play).toHaveBeenCalled();
  expect(video().muted).toBe(false);
  expectNoControls();
  expect(onSeen).not.toHaveBeenCalled();
  fireEvent.playing(video());
  expect(onSeen).toHaveBeenCalledTimes(1);
  expectNoControls();
  fireEvent.playing(video());
  expect(onSeen).toHaveBeenCalledTimes(1);
  expect(onEnd).not.toHaveBeenCalled();
});

it("播完：报 ended 一次，也算看过", async () => {
  const onEnd = vi.fn();
  const onSeen = vi.fn();
  render(<PromoPlayer onSeen={onSeen} onEnd={onEnd} />);
  await waitFor(() => expect(video().getAttribute("src")).toBeTruthy());
  fireEvent.ended(video());
  expect(onEnd).toHaveBeenCalledWith("ended");
  expect(onEnd).toHaveBeenCalledTimes(1);
  expect(onSeen).toHaveBeenCalledTimes(1);
});

it("Esc、Tab 不在播放器里拦下：Esc 交给桌面关掉最前面的窗口，Tab 照常走", async () => {
  const onKey = vi.fn();
  window.addEventListener("keydown", onKey);
  try {
    render(<PromoPlayer onEnd={vi.fn()} />);
    await waitFor(() => expect(video().getAttribute("src")).toBeTruthy());
    act(() => root().focus());
    expect(fireEvent.keyDown(root(), { key: "Escape" })).toBe(true);
    expect(fireEvent.keyDown(root(), { key: "Tab" })).toBe(true);
    expect(onKey.mock.calls.map(([event]) => (event as KeyboardEvent).key)).toEqual(["Escape", "Tab"]);
  } finally {
    window.removeEventListener("keydown", onKey);
  }
});

it("不让带声音自动播：静音播，画面上仍没有按钮；点画面打开声音，不暂停", async () => {
  play.mockRejectedValueOnce(notAllowed());
  const pause = vi.spyOn(HTMLMediaElement.prototype, "pause");
  render(<PromoPlayer onEnd={vi.fn()} />);
  await waitFor(() => expect(play).toHaveBeenCalledTimes(2));
  expect(video().muted).toBe(true);
  fireEvent.playing(video());
  expectNoControls();
  fireEvent.click(video());
  expect(video().muted).toBe(false);
  expect(pause).not.toHaveBeenCalled();
  expect(play).toHaveBeenCalledTimes(2);
});

it("静音也不让播（blocked）：算看过，窗口不关，停在封面只有「点画面播放」的提示；点画面带声音播，播完照样报 ended", async () => {
  play.mockRejectedValueOnce(notAllowed()).mockRejectedValueOnce(notAllowed());
  const onEnd = vi.fn();
  const onSeen = vi.fn();
  render(<PromoPlayer onSeen={onSeen} onEnd={onEnd} />);
  await waitFor(() => expect(onEnd).toHaveBeenCalledWith("blocked"));
  expect(onEnd).toHaveBeenCalledTimes(1);
  expect(onSeen).toHaveBeenCalledTimes(1);
  expect(play).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("status").textContent).toBe("点画面播放");
  expectNoControls();

  const setPaused = trackPaused();
  fireEvent.click(video());
  expect(play).toHaveBeenCalledTimes(3);
  expect(video().muted).toBe(false);
  setPaused(false);
  fireEvent.playing(video());
  expect(screen.queryByRole("status")).toBeNull();
  fireEvent.ended(video());
  expect(onEnd).toHaveBeenLastCalledWith("ended");
  expect(onEnd).toHaveBeenCalledTimes(2);
  expect(onSeen).toHaveBeenCalledTimes(1);
});

it("play() 被打断（AbortError 等）：按加载失败结束一次，画面上说明，不记看过，也不再静音重试", async () => {
  play.mockRejectedValueOnce(new DOMException("interrupted", "AbortError"));
  const onEnd = vi.fn();
  const onSeen = vi.fn();
  render(<PromoPlayer onSeen={onSeen} onEnd={onEnd} />);
  await waitFor(() => expect(onEnd).toHaveBeenCalledWith("failed"));
  expect(onEnd).toHaveBeenCalledTimes(1);
  expect(onSeen).not.toHaveBeenCalled();
  expect(screen.getByRole("status").textContent).toBe(PROMO_FAILED);
  // 被打断不是「不让带声音」：不再静音重试
  expect(play).toHaveBeenCalledTimes(1);
});

it("开了减少动态效果也照常播：播放器本身不看这个设置，要不要自动弹出由「加入我们」窗口决定（promoEntry）", async () => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === "(prefers-reduced-motion: reduce)", media: query, addEventListener() {}, removeEventListener() {} }));
  const onEnd = vi.fn();
  render(<PromoPlayer onEnd={onEnd} />);
  await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
  expect(video().muted).toBe(false);
  expect(onEnd).not.toHaveBeenCalled();
  expectNoControls();
});

it("片源放不了（play() 报 NotSupportedError）：按加载失败结束一次，不记看过", async () => {
  play.mockRejectedValue(new DOMException("no source", "NotSupportedError"));
  const onEnd = vi.fn();
  const onSeen = vi.fn();
  render(<PromoPlayer onSeen={onSeen} onEnd={onEnd} />);
  await waitFor(() => expect(onEnd).toHaveBeenCalledWith("failed"));
  expect(onEnd).toHaveBeenCalledTimes(1);
  expect(onSeen).not.toHaveBeenCalled();
});

it("起播时意外抛错（能力探测失败）：按加载失败结束一次", async () => {
  vi.mocked(detectCapabilities).mockRejectedValueOnce(new Error("probe crashed"));
  const onEnd = vi.fn();
  const onSeen = vi.fn();
  render(<PromoPlayer onSeen={onSeen} onEnd={onEnd} />);
  await waitFor(() => expect(onEnd).toHaveBeenCalledWith("failed"));
  expect(onEnd).toHaveBeenCalledTimes(1);
  expect(onSeen).not.toHaveBeenCalled();
});

it("播放器卸载以后能力探测才出错：不再结束一次（不调 onEnd）", async () => {
  let crash!: (error: Error) => void;
  // 项目 lib 是 ES2022，没有 Promise.withResolvers
  vi.mocked(detectCapabilities).mockReturnValueOnce(new Promise<Capabilities>((_, reject) => (crash = reject)));
  const onEnd = vi.fn();
  const view = render(<PromoPlayer onEnd={onEnd} />);
  view.unmount();
  await act(async () => {
    crash(new Error("probe crashed"));
  });
  expect(onEnd).not.toHaveBeenCalled();
});

it("两种播放方式都没有：报 unsupported，算看过（以后也播不了），画面上说明", async () => {
  caps.current = { mse: false, mseAv1Smooth: false, native: false, nativeAv1: false, touch: false };
  const onEnd = vi.fn();
  const onSeen = vi.fn();
  render(<PromoPlayer onSeen={onSeen} onEnd={onEnd} />);
  await waitFor(() => expect(onEnd).toHaveBeenCalledWith("unsupported"));
  expect(onSeen).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("status").textContent).toBe(PROMO_UNSUPPORTED);
  expect(play).not.toHaveBeenCalled();
});

it("原生播放加载失败：报 failed 但不记看过，下次再试", async () => {
  const onEnd = vi.fn();
  const onSeen = vi.fn();
  render(<PromoPlayer onSeen={onSeen} onEnd={onEnd} />);
  await waitFor(() => expect(video().getAttribute("src")).toBeTruthy());
  await act(async () => {
    fireEvent.error(video());
  });
  expect(onEnd).toHaveBeenCalledWith("failed");
  expect(onSeen).not.toHaveBeenCalled();
});

it("hls.js：先解析档位再按估计带宽定起播档，缓冲 30 秒，不开 worker", async () => {
  caps.current = { mse: true, mseAv1Smooth: false, native: false, nativeAv1: false, touch: true };
  render(<PromoPlayer onEnd={vi.fn()} />);
  await waitFor(() => expect(fakeHls.last?.source).toBe(PROMO.masters.h264));
  const player = fakeHls.last!;
  expect(player.config).toMatchObject({ enableWorker: false, autoStartLoad: false, maxBufferLength: 30, capLevelToPlayerSize: true });
  expect(player.started).toBeNull();
  // 手机没有网络信息时按 1Mbps 估计：700k 以内最高的是 360p（642k），在假档位里是下标 3
  act(() => player.handlers.get("manifestParsed")!());
  expect(player.startLevel).toBe(3);
  expect(player.started).toBe(-1);
  expect(player.levelAtStart).toBe(3);
});

it("播放中几秒不动鼠标，指针隐藏；动一下鼠标就回来", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  try {
    render(<PromoPlayer onEnd={vi.fn()} />);
    await waitFor(() => expect(video().getAttribute("src")).toBeTruthy());
    fireEvent.playing(video());
    act(() => vi.advanceTimersByTime(2600));
    expect(root().classList.contains("is-idle")).toBe(true);
    expectNoControls();
    pointer(root(), "pointermove", "mouse");
    expect(root().classList.contains("is-idle")).toBe(false);
    // 叫醒后重新计时，再不动又会淡出
    act(() => vi.advanceTimersByTime(2600));
    expect(root().classList.contains("is-idle")).toBe(true);
    // 手指划过不算
    pointer(root(), "pointermove", "touch");
    expect(root().classList.contains("is-idle")).toBe(true);
    // 停下时不隐藏
    pointer(root(), "pointermove", "mouse");
    fireEvent.pause(video());
    act(() => vi.advanceTimersByTime(5000));
    expect(root().classList.contains("is-idle")).toBe(false);
  } finally {
    vi.useRealTimers();
  }
});

it("点画面从不暂停（鼠标、手指都一样），空格和 M 也不暂停、不静音", async () => {
  const pause = vi.spyOn(HTMLMediaElement.prototype, "pause");
  render(<PromoPlayer onEnd={vi.fn()} />);
  await waitFor(() => expect(video().getAttribute("src")).toBeTruthy());
  const setPaused = trackPaused();
  setPaused(false);
  fireEvent.playing(video());
  for (const kind of ["mouse", "touch"] as const) {
    pointer(video(), "pointerdown", kind);
    act(() => root().focus());
    fireEvent.click(video());
  }
  fireEvent.keyDown(root(), { key: " " });
  fireEvent.keyDown(root(), { key: "m" });
  expect(pause).not.toHaveBeenCalled();
  expect(video().muted).toBe(false);
  expect(play).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("status")).toBeNull();
  expectNoControls();
});

it("被系统停下（手机切到后台等）：提示「点画面播放」，点画面接着播；播完那一下的 pause 不算停下", async () => {
  const onEnd = vi.fn();
  render(<PromoPlayer onEnd={onEnd} />);
  await waitFor(() => expect(video().getAttribute("src")).toBeTruthy());
  const setPaused = trackPaused();
  setPaused(false);
  fireEvent.playing(video());
  setPaused(true);
  fireEvent.pause(video());
  expect(screen.getByRole("status").textContent).toBe("点画面播放");
  expectNoControls();
  fireEvent.click(video());
  expect(play).toHaveBeenCalledTimes(2);
  setPaused(false);
  fireEvent.playing(video());
  expect(screen.queryByRole("status")).toBeNull();
  // 播完：浏览器先发 pause（此时 ended 已是 true）再发 ended
  Object.defineProperty(video(), "ended", { configurable: true, get: () => true });
  setPaused(true);
  fireEvent.pause(video());
  expect(screen.queryByRole("status")).toBeNull();
  fireEvent.ended(video());
  expect(onEnd).toHaveBeenCalledWith("ended");
});

it("播放中卡住：显示「正在缓冲…」，恢复后消失", async () => {
  render(<PromoPlayer onEnd={vi.fn()} />);
  await waitFor(() => expect(video().getAttribute("src")).toBeTruthy());
  fireEvent.playing(video());
  expect(screen.queryByRole("status")).toBeNull();
  fireEvent.waiting(video());
  expect(screen.getByRole("status").textContent).toContain("正在缓冲");
  fireEvent.playing(video());
  expect(screen.queryByRole("status")).toBeNull();
});

it("窗口收起（active 为 false）：正在播的暂停，露出来从停下的位置接着播", async () => {
  const pause = vi.spyOn(HTMLMediaElement.prototype, "pause");
  const view = render(<PromoPlayer onEnd={vi.fn()} />);
  await waitFor(() => expect(video().getAttribute("src")).toBeTruthy());
  fireEvent.playing(video());
  expect(play).toHaveBeenCalledTimes(1);

  view.rerender(<PromoPlayer active={false} onEnd={vi.fn()} />);
  expect(pause).toHaveBeenCalledTimes(1);
  fireEvent.pause(video());

  view.rerender(<PromoPlayer active onEnd={vi.fn()} />);
  expect(play).toHaveBeenCalledTimes(2);
  expect(video().getAttribute("src")).toBe(PROMO.masters.h264);
  fireEvent.playing(video());
  expect(screen.queryByRole("status")).toBeNull();
  expect(pause).toHaveBeenCalledTimes(1);
});

it("收起前就被浏览器停下的，露出来时不替它恢复；还没出画面时收起也不去暂停", async () => {
  const pause = vi.spyOn(HTMLMediaElement.prototype, "pause");
  const view = render(<PromoPlayer onEnd={vi.fn()} />);
  await waitFor(() => expect(video().getAttribute("src")).toBeTruthy());

  // 还没出画面（loading）：收起、露出都不碰视频
  view.rerender(<PromoPlayer active={false} onEnd={vi.fn()} />);
  view.rerender(<PromoPlayer active onEnd={vi.fn()} />);
  expect(pause).not.toHaveBeenCalled();
  expect(play).toHaveBeenCalledTimes(1);

  // 在播时被浏览器停下（paused），再收起、露出：停着的不动，也不恢复
  fireEvent.playing(video());
  fireEvent.pause(video());
  view.rerender(<PromoPlayer active={false} onEnd={vi.fn()} />);
  view.rerender(<PromoPlayer active onEnd={vi.fn()} />);
  expect(pause).not.toHaveBeenCalled();
  expect(play).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("status").textContent).toBe("点画面播放");
});

it("起播时窗口已经收起：不在后台出声，也不算看过；露出来再接着播", async () => {
  const pause = vi.spyOn(HTMLMediaElement.prototype, "pause");
  const onSeen = vi.fn();
  const view = render(<PromoPlayer active={false} onSeen={onSeen} onEnd={vi.fn()} />);
  await waitFor(() => expect(video().getAttribute("src")).toBeTruthy());

  fireEvent.playing(video());
  expect(pause).toHaveBeenCalledTimes(1);
  expect(onSeen).not.toHaveBeenCalled();

  view.rerender(<PromoPlayer active onSeen={onSeen} onEnd={vi.fn()} />);
  expect(play).toHaveBeenCalledTimes(2);
  fireEvent.playing(video());
  expect(onSeen).toHaveBeenCalledTimes(1);
});

it("关掉窗口（播放器卸载）：停止播放并释放片源，hls.js 也销毁", async () => {
  const load = vi.spyOn(HTMLMediaElement.prototype, "load");
  const native = render(<PromoPlayer onEnd={vi.fn()} />);
  await waitFor(() => expect(video().getAttribute("src")).toBeTruthy());
  const element = video();
  load.mockClear();
  native.unmount();
  expect(element.hasAttribute("src")).toBe(false);
  expect(load).toHaveBeenCalledTimes(1);

  caps.current = { mse: true, mseAv1Smooth: false, native: false, nativeAv1: false, touch: false };
  const engine = render(<PromoPlayer onEnd={vi.fn()} />);
  await waitFor(() => expect(fakeHls.last?.source).toBe(PROMO.masters.h264));
  const player = fakeHls.last!;
  expect(player.destroyed).toBe(false);
  engine.unmount();
  expect(player.destroyed).toBe(true);
});

it("回调每次渲染都可以是新函数：起播只跑一次，之后的结果报给最新的那个", async () => {
  const first = vi.fn();
  const latest = vi.fn();
  const view = render(<PromoPlayer onEnd={first} />);
  await waitFor(() => expect(video().getAttribute("src")).toBeTruthy());
  view.rerender(<PromoPlayer onEnd={latest} />);
  fireEvent.ended(video());
  expect(first).not.toHaveBeenCalled();
  expect(latest).toHaveBeenCalledWith("ended");
  expect(detectCapabilities).toHaveBeenCalledTimes(1);
});
