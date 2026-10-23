// @vitest-environment jsdom
// 开机动画的起步门（#275，SPEC §4.1）：电脑版点一下就起步；手机版（宽度小于 768 或竖屏）按下开始长按计时，
// 没按满就松手也起步，系统取消不起步；还在起步门时视口变了，按新的版本重建引擎。canvas 引擎换成假的，只看外壳怎么调它。
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { BootEngineOptions } from "../../app/web/sites/portal/components/boot/engine";

type FakeEngine = { opts: BootEngineOptions; start: ReturnType<typeof vi.fn>; beginHold: ReturnType<typeof vi.fn>; endHold: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> };
const fake = vi.hoisted(() => ({ engines: [] as FakeEngine[] }));

vi.mock("../../app/web/sites/portal/components/boot/engine", () => ({
  createBootEngine: (_canvas: HTMLCanvasElement, opts: BootEngineOptions) => {
    const engine = { opts, start: vi.fn(), beginHold: vi.fn(), endHold: vi.fn(), skip: vi.fn(), replay: vi.fn(), toggleMute: vi.fn(() => false), dispose: vi.fn() };
    fake.engines.push(engine);
    return engine;
  },
}));

import BootSequence from "../../app/web/sites/portal/components/boot/BootSequence";

function viewport(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
}
const latest = () => fake.engines[fake.engines.length - 1];

beforeEach(() => {
  fake.engines.length = 0;
});
afterEach(() => {
  cleanup();
  viewport(1024, 768);
});

it("电脑版：按下就起步", () => {
  viewport(1440, 900);
  render(<BootSequence onReady={() => {}} prefetch={() => {}} />);
  expect(latest().opts.mobile).toBe(false);
  fireEvent.pointerDown(screen.getByRole("button", { name: "启动 YUGC OS" }));
  expect(latest().start).toHaveBeenCalledTimes(1);
  expect(latest().beginHold).not.toHaveBeenCalled();
});

it("手机版（390×844）：按下开始长按计时，松手起步；系统取消只停计时不起步", () => {
  viewport(390, 844);
  render(<BootSequence onReady={() => {}} prefetch={() => {}} />);
  const engine = latest();
  expect(engine.opts.mobile).toBe(true);
  const gate = screen.getByRole("button", { name: "长按启动 YUGC OS" });
  fireEvent.pointerDown(gate);
  expect(engine.beginHold).toHaveBeenCalledTimes(1);
  expect(engine.start).not.toHaveBeenCalled();
  fireEvent.pointerCancel(gate);
  expect(engine.endHold).toHaveBeenCalledTimes(1);
  expect(engine.start).not.toHaveBeenCalled();
  fireEvent.pointerDown(gate);
  fireEvent.pointerUp(gate);
  expect(engine.start).toHaveBeenCalledTimes(1);
});

it("还在起步门时视口从横屏电脑变成竖屏手机：重建成手机版引擎，旧的释放", () => {
  viewport(1440, 900);
  render(<BootSequence onReady={() => {}} prefetch={() => {}} />);
  const desktop = latest();
  act(() => {
    viewport(390, 844);
    window.dispatchEvent(new Event("resize"));
  });
  expect(desktop.dispose).toHaveBeenCalledTimes(1);
  expect(latest()).not.toBe(desktop);
  expect(latest().opts.mobile).toBe(true);
  expect(screen.getByRole("button", { name: "长按启动 YUGC OS" })).toBeTruthy();
});
