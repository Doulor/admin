// 官网首页（SPEC §4.1）：今天（北京时间）没播过开机动画就先播，播完或跳过后淡出、露出桌面；
// 今天播过了、或者开了「减少动态效果」，直接进桌面（淡入 300ms）。?boot=1 强制重播，不改记录。
// 开机动画和桌面都按需加载：只进桌面的人不下载开机动画，播动画期间浏览器空闲时再预取桌面。
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { BootReady } from "../components/boot/engine";
import { beijingDay, forcedReplay, readBootDay, shouldPlayBoot, writeBootDay } from "../lib/bootGate";
import { PHONE_QUERY, PORTRAIT_QUERY } from "../lib/useMediaQuery";
import { useReducedMotion } from "../lib/useReducedMotion";
import { loadWallpaperImage, readWallpaperChoice, wallpaperForScreen } from "../lib/wallpapers";
import "../styles/portal.css";
import "../styles/boot.css";
import "../styles/competitions.css";

const loadDesktop = () => import("../components/os/YugcOs");
const YugcOs = lazy(loadDesktop);
const BootSequence = lazy(() => import("../components/boot/BootSequence"));

/** 就绪后在最后一帧停多久再淡出：自然播完让人看清「SYSTEM READY」，跳过时尽快进桌面 */
const HOLD_MS = { played: 800, skipped: 300 } as const;
/** 与 styles/boot.css 的 .pt-boot-layer 过渡时长一致 */
const FADE_MS = 320;

/** boot 播放中；handoff 已就绪、桌面在底下挂好；fading 开机动画层淡出；desktop 只剩桌面 */
type Stage = "boot" | "handoff" | "fading" | "desktop";

export default function Home() {
  const reducedMotion = useReducedMotion();
  const [plan, setPlan] = useState(() => {
    const force = forcedReplay(window.location.search);
    return { force, play: shouldPlayBoot({ playedDay: readBootDay(), today: beijingDay(), reducedMotion, force }) };
  });
  const [stage, setStage] = useState<Stage>(plan.play ? "boot" : "desktop");
  /** 刚播完的开机动画的起点：桌面的「晴空」壁纸按它接上最后一帧 */
  const [bootEpoch, setBootEpoch] = useState<number | null>(null);
  const desktopRef = useRef<HTMLDivElement | null>(null);
  /** 开机动画还盖着桌面时，桌面不可聚焦、不可点 */
  const covered = stage === "handoff" || stage === "fading";
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  // 用户选的是图片壁纸时，桌面出现前先把图下好（默认的「晴空」是画出来的，不用下）
  useEffect(() => {
    const phonePortrait = window.matchMedia(PHONE_QUERY).matches && window.matchMedia(PORTRAIT_QUERY).matches;
    const surface = wallpaperForScreen(readWallpaperChoice(), phonePortrait);
    if (surface.kind === "image") void loadWallpaperImage(surface.image);
  }, []);

  const onReady = (info: BootReady) => {
    if (!plan.force) writeBootDay(beijingDay());
    setBootEpoch(info.epoch);
    setStage("handoff");
    const hold = new Promise((resolve) => timers.current.push(window.setTimeout(resolve, info.skipped ? HOLD_MS.skipped : HOLD_MS.played)));
    // 桌面代码块没下完就等它下完再淡出，不露出空白
    void Promise.all([hold, loadDesktop().catch(() => undefined)]).then(() => {
      setStage("fading");
      timers.current.push(window.setTimeout(() => setStage("desktop"), FADE_MS + 40));
    });
  };

  // 桌面菜单里的「重播开机动画」：和 ?boot=1 一样不改记录，桌面先卸掉，播完重新挂
  const replayBoot = () => {
    setPlan({ force: true, play: true });
    setStage("boot");
  };

  // 开机动画层卸掉后，焦点还在 <body> 上就放进桌面的主操作
  useEffect(() => {
    if (stage !== "desktop" || !plan.play) return;
    if (document.activeElement && document.activeElement !== document.body) return;
    desktopRef.current?.querySelector<HTMLElement>('[data-cta="join"]')?.focus({ preventScroll: true });
  }, [stage, plan.play]);

  return (
    <div className="pt-root pt-home">
      {stage !== "boot" && (
        <div
          // 用 ref 回调而不是 effect 设 inert：要赶在桌面自己的挂载 effect（把焦点放进桌面）之前生效
          ref={(node) => {
            desktopRef.current = node;
            if (node) node.inert = covered;
          }}
          className={plan.play ? "pt-desktop-layer" : "pt-desktop-layer is-entering"}>
          <Suspense fallback={null}>
            <YugcOs onReplayBoot={replayBoot} boot={bootEpoch === null ? null : { epoch: bootEpoch, settled: stage === "desktop" }} />
          </Suspense>
        </div>
      )}
      {plan.play && stage !== "desktop" && (
        <div className={stage === "fading" ? "pt-boot-layer is-leaving" : "pt-boot-layer"}>
          <Suspense fallback={<div className="pt-boot-wait" />}>
            <BootSequence onReady={onReady} prefetch={loadDesktop} />
          </Suspense>
        </div>
      )}
    </div>
  );
}
