import type { Directive } from "vue";

/**
 * 用在 TxTabs 上：首次显示时指示条直接停在当前页签下面。
 * TxTabs 0.6.0 挂载后才给指示条写位置，指示条的 CSS 过渡会让它从导航左上角斜着滑过来（约 350ms）。
 * 挂载时先关掉指示条的过渡，等两帧（TxTabs 的首次定位和 ResizeObserver 复位都做完）再还原，之后切页签照常有动画。
 * 指示条的 style 只由 TxTabs 逐项写（opacity、transform、width、height），不会覆盖这里的 transition。
 */
export const vSnapIndicator: Directive<HTMLElement> = {
  mounted(el) {
    const pointer = el.querySelector<HTMLElement>(".tx-tabs__pointer");
    if (!pointer) return;
    pointer.style.transition = "none";
    requestAnimationFrame(() => requestAnimationFrame(() => { pointer.style.transition = ""; }));
  },
};
