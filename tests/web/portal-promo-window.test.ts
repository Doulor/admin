// 宣传片窗口（#284）的纯逻辑：什么时候自动弹出、窗口多大放哪、窗口收起和露出来时对视频做什么。
// 窗口开、关、最小化、恢复在桌面里的表现见 portal-promo-desktop.test.tsx。
import { describe, expect, it } from "vitest";
import { promoEntry, promoTop, promoWidth, visibilityStep, type PromoPhase } from "../../app/web/sites/portal/lib/promoWindow";

describe("「加入我们」窗口挂上时要不要弹宣传片（#77、#122 的条件原样保留）", () => {
  it("没看过、没开减少动态效果：弹；开了减少动态效果：不弹也不下载，只按看过算；看过了：什么都不做", () => {
    expect(promoEntry({ seen: false, reducedMotion: false })).toBe("open");
    expect(promoEntry({ seen: false, reducedMotion: true })).toBe("mark_seen");
    expect(promoEntry({ seen: true, reducedMotion: false })).toBe("none");
    expect(promoEntry({ seen: true, reducedMotion: true })).toBe("none");
  });
});

describe("窗口收起、露出来时对视频做什么", () => {
  const step = (visible: boolean, phase: PromoPhase, pausedByHide: boolean) => visibilityStep(visible, phase, pausedByHide);

  it("收起：正在播和卡在缓冲的暂停并记下是我们停的；还没出画面、已经被浏览器停下的不动", () => {
    expect(step(false, "playing", false)).toEqual({ act: "pause", pausedByHide: true });
    expect(step(false, "buffering", false)).toEqual({ act: "pause", pausedByHide: true });
    expect(step(false, "loading", false)).toEqual({ act: null, pausedByHide: false });
    expect(step(false, "paused", false)).toEqual({ act: null, pausedByHide: false });
  });

  it("露出来：只恢复我们停的，从停下的位置接着播；不是我们停的不恢复", () => {
    expect(step(true, "paused", true)).toEqual({ act: "play", pausedByHide: false });
    expect(step(true, "paused", false)).toEqual({ act: null, pausedByHide: false });
    expect(step(true, "playing", false)).toEqual({ act: null, pausedByHide: false });
  });

  it("暂停以后阶段变成 paused，再来一次收起通知不重复暂停、记号不丢；露出来再收起，每一轮都重新判断", () => {
    expect(step(false, "paused", true)).toEqual({ act: null, pausedByHide: true });

    const hidden = step(false, "playing", false);
    const shown = step(true, "paused", hidden.pausedByHide);
    expect(shown).toEqual({ act: "play", pausedByHide: false });
    expect(step(false, "playing", shown.pausedByHide)).toEqual({ act: "pause", pausedByHide: true });
  });
});

describe("桌面上宣传片窗口多大、放哪", () => {
  const total = (viewport: { width: number; height: number }) => 44 + Math.round((promoWidth(viewport) * 9) / 16);

  it("电脑：画面 16:9，宽度最大 860；屏幕矮时变窄，窗口（标题栏加画面）总放得进顶边到 Dock 上沿", () => {
    expect(promoWidth({ width: 1440, height: 900 })).toBe(860);
    expect(promoWidth({ width: 1920, height: 1080 })).toBe(860);
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 1024, height: 640 }, { width: 800, height: 500 }]) {
      expect(total(viewport), JSON.stringify(viewport)).toBeLessThanOrEqual(viewport.height - 44 - 120);
    }
    expect(promoWidth({ width: 1024, height: 640 })).toBeLessThan(860);
  });

  it("手机宽度：左右各留 12px 边，不超出屏幕", () => {
    expect(promoWidth({ width: 390, height: 844 })).toBe(390 - 24);
    expect(promoWidth({ width: 360, height: 640 })).toBeLessThanOrEqual(360 - 24);
  });

  it("顶边：层叠位置放得下就用它；放不下往上提到窗口整个落在 Dock 上沿以上；最高到菜单栏下面", () => {
    const roomy = { width: 1440, height: 900 };
    expect(promoTop(roomy, 64)).toBe(64);
    expect(promoTop(roomy, 64 + 3 * 36)).toBe(64 + 3 * 36);

    const short = { width: 1440, height: 700 };
    const top = promoTop(short, 64 + 3 * 36);
    expect(top).toBeLessThan(64 + 3 * 36);
    expect(top).toBeGreaterThanOrEqual(44);
    expect(top + total(short)).toBeLessThanOrEqual(short.height - 120);

    expect(promoTop({ width: 1440, height: 400 }, 64)).toBe(44);
  });
});
