// 开机动画的 React 外壳：挂 canvas、起步（桌面点击或按任意键，手机长按）、静音/重播/跳过三个真实按钮、
// 键盘快捷键（Esc 跳过、M 静音、R 重播）、播放期间空闲时预取桌面代码块。动画本身在 ./engine.ts。
// 就绪（播完或跳过）时调 onReady，由首页（pages/Home.tsx）写 yugc:boot-day 并把这一层淡出、露出桌面。
import { useEffect, useRef, useState } from "react";
import girlSrc from "../../assets/mascot/geek-girl.webp";
import { reportEvent } from "../../lib/events";
import Icon from "../Icon";
import { createBootEngine, type BootEngine, type BootPhase, type BootReady } from "./engine";

const MUTE_KEY = "yugc:boot-muted";

/** 宽度小于 768 或竖屏时用手机版（SPEC §4.1），创建时定好，播放期间不跟着旋转屏幕变 */
function detectMobile(): boolean {
  return window.innerWidth < 768 || window.matchMedia("(orientation: portrait)").matches;
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

function saveMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* 隐私模式写不进去：只影响下次是否记得静音 */
  }
}

const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta", "CapsLock", "Fn"]);

type Props = {
  onReady: (info: BootReady) => void;
  /** 播放期间浏览器空闲时调用一次，用来预取桌面的代码块 */
  prefetch: () => unknown;
};

export default function BootSequence({ onReady, prefetch }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const safeRef = useRef<HTMLSpanElement>(null);
  const engineRef = useRef<BootEngine | null>(null);
  const [mobile] = useState(detectMobile);
  const [phase, setPhase] = useState<BootPhase>("gate");
  const [muted, setMuted] = useState(readMuted);
  const handlers = useRef({ onReady, prefetch });
  handlers.current = { onReady, prefetch };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = createBootEngine(canvas, {
      mobile,
      girlSrc,
      muted: readMuted(),
      insets: () => {
        const style = safeRef.current ? getComputedStyle(safeRef.current) : null;
        return { top: parseFloat(style?.paddingTop ?? "") || 0, bottom: parseFloat(style?.paddingBottom ?? "") || 0 };
      },
      onStart: () => setPhase("dark"),
      onPhase: setPhase,
      onReady: (info) => {
        reportEvent(info.skipped ? "os.boot.skipped" : "os.boot.played", { meta: { mobile } });
        handlers.current.onReady(info);
      },
    });
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [mobile]);

  const playing = phase === "dark" || phase === "light";
  const toggleMute = () => {
    const next = engineRef.current?.toggleMute() ?? muted;
    setMuted(next);
    saveMuted(next);
  };

  // 没开始时任意键起步（音频也在这一下解锁）；播放中 Esc 跳过、M 静音、R 重播；就绪后不再响应
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine || event.metaKey || event.ctrlKey || event.altKey || MODIFIER_KEYS.has(event.key) || event.repeat) return;
      if (phase === "gate") {
        engine.start();
        return;
      }
      if (!playing) return;
      const key = event.key.toLowerCase();
      if (key === "escape") engine.skip();
      else if (key === "m") toggleMute();
      else if (key === "r") engine.replay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // 开始播放后，浏览器空闲时预取桌面代码块，就绪时立刻能接上（SPEC §4.1）
  const started = phase !== "gate";
  useEffect(() => {
    if (!started) return;
    const run = () => void handlers.current.prefetch();
    if (window.requestIdleCallback) {
      const id = window.requestIdleCallback(run, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(run, 600);
    return () => window.clearTimeout(id);
  }, [started]);

  return (
    <div className={`pt-bootseq${phase === "light" || phase === "ready" ? " is-light" : ""}`}>
      <canvas ref={canvasRef} className="pt-bootseq-canvas" aria-hidden="true" />
      <span ref={safeRef} className="pt-bootseq-safe" aria-hidden="true" />
      {phase === "gate" && (
        <button
          type="button"
          className="pt-bootseq-gate"
          aria-label={mobile ? "长按启动 YUGC OS" : "启动 YUGC OS"}
          onPointerDown={() => (mobile ? engineRef.current?.beginHold() : engineRef.current?.start())}
          onPointerUp={() => mobile && engineRef.current?.endHold()}
          onPointerCancel={() => mobile && engineRef.current?.endHold()}
          onPointerLeave={() => mobile && engineRef.current?.endHold()}
          // 键盘触发的 click（detail 为 0）直接起步；手机上手指点按要长按满，不能一点就开始
          onClick={(event) => (!mobile || event.detail === 0) && engineRef.current?.start()}
          onContextMenu={(event) => event.preventDefault()}
        />
      )}
      {playing && (
        <>
          <div className="pt-bootseq-ctrl">
            <button type="button" aria-label={muted ? "打开声音" : "静音"} aria-pressed={muted} onClick={toggleMute}>
              <span className="pt-bootseq-dot">
                <Icon name={muted ? "volume-mute-line" : "volume-up-line"} size={17} />
              </span>
            </button>
            <button type="button" aria-label="重播" onClick={() => engineRef.current?.replay()}>
              <span className="pt-bootseq-dot">
                <Icon name="restart-line" size={17} />
              </span>
            </button>
          </div>
          <button type="button" className="pt-bootseq-skip" onClick={() => engineRef.current?.skip()}>
            <Icon name="skip-forward-line" size={16} />
            跳过
            {!mobile && <kbd>Esc</kbd>}
          </button>
        </>
      )}
    </div>
  );
}
