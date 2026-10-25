// 宣传片播放器按需加载。分包加载失败（断网、发版后旧页面找不到新文件名）时当作「播放失败」在窗口里说明，
// 不让整个官网跟着卸载：宣传片不挡报名。
// 失败只算这一次打开（#110）：React.lazy 会一直记住第一次加载的结果，所以失败的那个用过就换一个新的；
// 浏览器也记着加载失败的分包地址，所以重来时由 retryableImport 换成写死的 ?retry=n 地址重新加载。
// 播放器样式放在这里（跟官网主包走），不跟播放器分包：Vite 的分包预加载把失败过的样式表记为已加载、不再重试，
// 断网失败过一次以后，换地址加载回来的播放器会没有样式。
import { lazy, Suspense, useEffect, useRef, useState, type ComponentProps, type ComponentType, type LazyExoticComponent, type ReactNode } from "react";
import { retryableImport } from "../lib/promo";
import { PROMO_FAILED } from "../lib/promoWindow";
import type PromoPlayer from "./PromoPlayer";
import Icon from "./Icon";
import "../styles/promo.css";

type Props = ComponentProps<typeof PromoPlayer>;

// 换地址的那几个以生产构建为准：开发服务器下 .tsx 带查询参数加载可能报 React 刷新的 preamble 错误
const importPlayer = retryableImport([
  () => import("./PromoPlayer"),
  // @ts-expect-error 同一模块，只为换地址
  () => import("./PromoPlayer?retry=1"),
  // @ts-expect-error 同上
  () => import("./PromoPlayer?retry=2"),
  // @ts-expect-error 同上
  () => import("./PromoPlayer?retry=3"),
]);
/**
 * failed：这个分包加载失败过；closed：打开它的那一次已经关掉了（比如加载中就把窗口关了）。
 * 失败要有人显示出来（PromoUnavailable）才换新的；打开的那次已经关掉、没人会显示时，失败一到就换。
 */
type Loaded = { Player: LazyExoticComponent<ComponentType<Props>>; failed: boolean; closed: boolean };
const loadPlayer = (): Loaded => {
  const loaded: Loaded = {
    failed: false,
    closed: false,
    Player: lazy(() =>
      importPlayer().catch(() => {
        loaded.failed = true;
        if (loaded.closed) replace(loaded);
        return { default: PromoUnavailable };
      }),
    ),
  };
  return loaded;
};
let current = loadPlayer();
/** 换成新的：只换还在用的那个，已经换过就不再换 */
const replace = (stale: Loaded) => {
  if (current === stale) current = loadPlayer();
};

/** 窗口正文里的画面框：播放器、加载中和加载失败共用同一套版面，换的时候窗口大小不动 */
function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="pt-promo">
      <div className="pt-promo-frame">
        <div className="pt-promo-stage">{children}</div>
      </div>
    </div>
  );
}

/** 只结束一次：父组件传的 onEnd 每次渲染都是新函数，不能靠依赖数组防重复 */
function PromoUnavailable({ onEnd }: Props) {
  const ended = useRef(false);
  useEffect(() => {
    if (ended.current) return;
    ended.current = true;
    // 失败真正显示出来以后才换：换早了，挂起后重试的那次渲染会拿到新的，又去加载一遍。
    // 第一次打开宣传片窗口时这个组件和窗口内容可能一起还没提交（React 等分包时会丢掉没提交的渲染重来），
    // 那时 LazyPromoPlayer 的初始化会再跑一遍，所以不能在初始化里换
    current = loadPlayer();
    onEnd("failed");
  }, [onEnd]);
  return (
    <Frame>
      <p className="pt-promo-status" role="status">
        {PROMO_FAILED}
      </p>
    </Frame>
  );
}

/**
 * 打开一次宣传片：记住当时那个播放器，打开期间父组件重渲染，不会换成新的再加载一遍。
 * 分包在这里自己挂起（Suspense 在本组件里面），所以挂上以后，等分包的整段时间里本组件的状态一直在。
 * 分包没到时窗口里先显示「正在加载…」（#122），分包到了以后换成真正的播放器，两者版面一样。
 */
export function LazyPromoPlayer(props: Props) {
  const [loaded] = useState(() => current);
  // 关掉时：分包已经失败过（失败还没来得及显示）就换新的；还没结果就记下，失败一到再换（#122 加载中就关了窗口）
  useEffect(() => {
    loaded.closed = false;
    return () => {
      loaded.closed = true;
      if (loaded.failed) replace(loaded);
    };
  }, [loaded]);
  const { Player } = loaded;
  return (
    <Suspense fallback={<PromoFallback />}>
      <Player {...props} />
    </Suspense>
  );
}

/** 播放器分包还在下载时窗口里的加载提示（#122）：弱网下分包要几秒才到，这段时间不能是一块空白 */
function PromoFallback() {
  return (
    <Frame>
      <p className="pt-promo-status" role="status">
        <Icon name="loader-4-line" size={18} className="pt-spin" />
        正在加载…
      </p>
    </Frame>
  );
}
