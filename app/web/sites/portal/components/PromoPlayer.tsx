// 宣传片播放器（#77、#103、#142）。#284 起它是桌面「宣传片」窗口的正文，不再是盖住整个页面的全屏层：
// 关闭、最小化、放大、层叠都用桌面窗口自己的，画面上不放任何按钮，播完由桌面关掉窗口；Esc 也是桌面的（关掉最前面的窗口）。
// 2026-09-26（#142）：「宣传片这边不需要这个进度条和播放暂停啥的，只需要右上角的跳过，就是让人无感播放」。
// 所以没有播放 / 暂停、进度、时间、音量这些控件。点画面从不暂停，只会让片子往「在播、有声音」走：
// 被系统或浏览器停下了就接着播，静音就打开声音（点击是用户手势，浏览器这时允许带声音播）。
// 画面按 16:9 铺满窗口宽度，窗口放大或手机上窗口比画面高时，空白由画面本身的低清模糊色填满。播放中几秒不动鼠标，指针隐藏。
// 窗口最小化（手机上是被别的窗口盖住）时 active 变 false：正在播的暂停，露出来时从停下的位置接着播；起播时窗口已经收起就先不出声，露出来再播。
// 播放按 lib/promo.ts 的规则挑 hls.js 或原生 HLS、AV1 或 H.264，从估计带宽撑得住的一档起播；hls.js 按需加载，不进首屏包，
// 分包加载失败过（包括桌面预取时断网）下次换地址重新加载（lib/promo.ts 的 retryableImport，#110）。窗口关掉（组件卸载）就停止播放并释放片源。
// 能带声音自动播就带声音；浏览器不让就静音播。静音也不让播时（blocked）停在封面，点画面就播：窗口不挡着别的东西，不用像全屏层那样直接关掉。
// 浏览器两种方式都不支持（unsupported）或加载失败（failed）时在画面上说明，宣传片不挡报名；
// unsupported、blocked 是浏览器或用户的设置，以后多半也不会自动播，算作看过；failed 可能只是网络问题，不记，下次再试。
import { useCallback, useEffect, useRef, useState } from "react";
import type Hls from "hls.js/light";
import { PROMO, browserEstimate, choosePlayback, detectCapabilities, retryableImport, startLevelIndex, type Playback } from "../lib/promo";
import { PROMO_FAILED, PROMO_UNSUPPORTED, visibilityStep, type PromoPhase } from "../lib/promoWindow";
import Icon from "./Icon";

export type PromoEnd = "ended" | "blocked" | "unsupported" | "failed";

type Props = {
  /** 窗口露出来才播：最小化（手机上是被别的窗口盖住）就暂停，露出来从停下的位置接着播；默认一直露着 */
  active?: boolean;
  /** 真正开始播放、播完或浏览器根本不让播时调用一次（自动弹出的那次用它写「已播过」的 cookie） */
  onSeen?: () => void;
  /** 播完（ended）、静音也不让自动播（blocked，停在封面）、两种播放方式都没有（unsupported）、加载失败（failed）时各调用一次；blocked 之后点画面播完还会再来一次 ended */
  onEnd: (reason: PromoEnd) => void;
};

/** 过了这么久还没出画面（或卡住没恢复），就提示可以先关掉 */
const SLOW_MS = 6000;
/** 播放中这么久不动鼠标，指针隐藏 */
const IDLE_MS = 2500;
/** 背景模糊色多久取一次画面：只画 32×18 的小图，开销可以忽略 */
const AMBIENT_MS = 500;

// 换地址的那几个以生产构建为准（Vite 把每个打成文件名不同的分包）
const importHls = retryableImport([
  () => import("hls.js/light"),
  // @ts-expect-error 同一模块，只为换地址
  () => import("hls.js/light?retry=1"),
  // @ts-expect-error 同上
  () => import("hls.js/light?retry=2"),
  // @ts-expect-error 同上
  () => import("hls.js/light?retry=3"),
]);

export default function PromoPlayer({ active = true, onSeen, onEnd }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const ambient = useRef<HTMLCanvasElement>(null);
  const hls = useRef<Hls | null>(null);
  const seen = useRef(false);
  const finished = useRef(false);
  const blockedSent = useRef(false);
  const idleTimer = useRef<number | undefined>(undefined);
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [state, setState] = useState<PromoPhase>("loading");
  const [over, setOver] = useState<"unsupported" | "failed" | null>(null);
  const [slow, setSlow] = useState(false);
  const [idle, setIdle] = useState(false);
  const [poster] = useState(() => (typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches ? PROMO.posterSmall : PROMO.poster));
  // 起播流程只在挂载时跑一次，父组件之后每次渲染传来的新回调和窗口是否露着，都要读到最新的
  const seenCallback = useRef(onSeen);
  seenCallback.current = onSeen;
  const endCallback = useRef(onEnd);
  endCallback.current = onEnd;
  const visible = useRef(active);
  visible.current = active;
  const phase = useRef(state);
  phase.current = state;
  /** 是窗口收起时我们自己暂停的：露出来才恢复；被浏览器停下的不算 */
  const pausedByHide = useRef(false);

  const markSeen = useCallback(() => {
    if (seen.current) return;
    seen.current = true;
    seenCallback.current?.();
  }, []);

  /** 播完、放不了、加载失败：只结束一次 */
  const finish = useCallback(
    (reason: Exclude<PromoEnd, "blocked">) => {
      if (finished.current) return;
      finished.current = true;
      if (reason !== "failed") markSeen();
      video.current?.pause();
      if (reason === "unsupported" || reason === "failed") setOver(reason);
      endCallback.current(reason);
    },
    [markSeen],
  );

  /** 指针回来，并重新计时隐藏 */
  const wake = useCallback(() => {
    setIdle(false);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setIdle(true), IDLE_MS);
  }, []);
  useEffect(() => {
    wake();
    return () => window.clearTimeout(idleTimer.current);
  }, [wake]);

  // 挑播放方式并挂上片源
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    let cancelled = false;
    // hls.js 分包与能力探测同时开始：多数浏览器会用 hls.js，串行等会多一次往返
    const hlsModule = importHls();
    hlsModule.catch(() => undefined);
    /** 自动播被拒：片源放不了或被打断按加载失败结束；静音也不让播（NotAllowedError）停在封面等人点 */
    const refused = (name: string) => {
      if (name !== "NotAllowedError") return finish("failed");
      setState("paused");
      markSeen();
      if (blockedSent.current) return;
      blockedSent.current = true;
      endCallback.current("blocked");
    };
    (async () => {
      const caps = await detectCapabilities(element);
      const choice = choosePlayback(caps);
      if (cancelled) return;
      if (!choice) return finish("unsupported");
      setPlayback(choice);
      if (choice.engine === "native") {
        element.src = choice.src;
      } else {
        let HlsJs: typeof import("hls.js/light").default;
        try {
          HlsJs = (await hlsModule).default;
        } catch {
          // 卸载后分包才失败：播放器已经不在了，不再结束一次
          if (!cancelled) finish("failed");
          return;
        }
        if (cancelled) return;
        const estimate = browserEstimate(caps.touch);
        // 不开 worker：fMP4 不需要转封装，也省得给 CSP 加 worker-src blob:
        // 起播档由 startLevelIndex 定（与桌面上预取的是同一档），之后按实测带宽切换；缓冲放到 30 秒，弱网少卡
        const player = new HlsJs({
          enableWorker: false,
          autoStartLoad: false,
          capLevelToPlayerSize: true,
          maxDevicePixelRatio: 2,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          abrEwmaDefaultEstimate: Math.max(estimate, 200_000),
        });
        hls.current = player;
        let recovered = false;
        player.on(HlsJs.Events.MANIFEST_PARSED, () => {
          player.startLevel = startLevelIndex(player.levels.map((level) => level.bitrate), estimate);
          player.startLoad(-1);
        });
        player.on(HlsJs.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;
          if (data.type === HlsJs.ErrorTypes.MEDIA_ERROR && !recovered) {
            recovered = true;
            player.recoverMediaError();
            return;
          }
          finish("failed");
        });
        player.loadSource(choice.src);
        player.attachMedia(element);
      }
      try {
        element.muted = false;
        await element.play();
      } catch (error) {
        if (cancelled) return;
        let name = (error as DOMException).name;
        if (name === "NotAllowedError") {
          // 不让带声音自动播：静音再试一次
          try {
            element.muted = true;
            await element.play();
            return;
          } catch (again) {
            if (cancelled) return;
            name = (again as DOMException).name;
          }
        }
        refused(name);
      }
    })().catch(() => {
      // 起播过程中意外抛错（能力探测、hls.js 初始化等）：按加载失败结束，不留一直转圈的播放器
      if (!cancelled) finish("failed");
    });
    return () => {
      cancelled = true;
      hls.current?.destroy();
      hls.current = null;
      element.removeAttribute("src");
      element.load();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在挂载时挑一次片源
  }, []);

  // 窗口收起就暂停、露出来接着播（lib/promoWindow.ts 的 visibilityStep）
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    const step = visibilityStep(active, phase.current, pausedByHide.current);
    pausedByHide.current = step.pausedByHide;
    if (step.act === "pause") element.pause();
    else if (step.act === "play") void element.play().catch(() => undefined);
  }, [active]);

  // 画面外的空白：把当前画面缩成 32×18 画到背景画布上，CSS 再放大模糊。出画面之前先用封面。
  // 跨域的原生 HLS 会让画布「受污染」，但这里只显示、从不读像素，不受影响。
  useEffect(() => {
    const canvas = ambient.current;
    const element = video.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !element || !context) return;
    const draw = (source: CanvasImageSource) => context.drawImage(source, 0, 0, canvas.width, canvas.height);
    const image = new Image();
    image.onload = () => {
      if (element.readyState < 2) draw(image);
    };
    image.src = poster;
    const timer = window.setInterval(() => {
      if (element.readyState >= 2 && !element.paused) draw(element);
    }, AMBIENT_MS);
    return () => window.clearInterval(timer);
  }, [poster]);

  useEffect(() => {
    if (state !== "loading" && state !== "buffering") return;
    const timer = window.setTimeout(() => setSlow(true), SLOW_MS);
    return () => window.clearTimeout(timer);
  }, [state]);

  /** 点画面：从不暂停。静音就打开声音；停着（被系统或浏览器暂停，或自动播被拒）就接着播 */
  const engage = () => {
    const element = video.current;
    if (!element) return;
    element.muted = false;
    if (state === "paused") void element.play().catch(() => undefined);
  };

  const waiting = state === "loading" || state === "buffering";
  const status =
    over === "unsupported"
      ? PROMO_UNSUPPORTED
      : over === "failed"
        ? PROMO_FAILED
        : state === "paused"
          ? "点画面播放"
          : !waiting
            ? null
            : slow
              ? "网络有点慢，再等一等，或者先关掉这个窗口"
              : state === "buffering"
                ? "正在缓冲…"
                : "正在加载…";
  return (
    <div className={`pt-promo${idle && state === "playing" ? " is-idle" : ""}`} onPointerMove={(event) => event.pointerType === "mouse" && wake()} data-codec={playback?.codec} data-engine={playback?.engine}>
      <canvas ref={ambient} className="pt-promo-ambient" width={32} height={18} aria-hidden="true" />
      <div className="pt-promo-frame">
        <div className="pt-promo-stage">
          <video
            ref={video}
            className="pt-promo-video"
            poster={poster}
            playsInline
            preload="auto"
            onPlaying={(event) => {
              if (!visible.current) {
                // 起播时窗口已经收起：不在后台出声，记下是我们停的，露出来再接着播
                pausedByHide.current = true;
                event.currentTarget.pause();
                return;
              }
              setState("playing");
              setSlow(false);
              markSeen();
            }}
            onWaiting={() => setState((current) => (current === "playing" ? "buffering" : current))}
            // 播完时先有一次 pause 再有 ended：那一次不算停下，免得关掉前闪一下「点画面播放」
            onPause={(event) => !event.currentTarget.ended && setState((current) => (current === "playing" || current === "buffering" ? "paused" : current))}
            onEnded={() => finish("ended")}
            onError={() => playback?.engine === "native" && finish("failed")}
            onClick={engage}
          />

          {status && (
            <p className="pt-promo-status" role="status">
              {!over && waiting && <Icon name="loader-4-line" size={18} className="pt-spin" />}
              {status}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
