// 首屏的一行终端：打字机效果，等宽字体，颜色取开机动画 BIOS 段的绿；打完后光标闪烁。
// 减少动态效果时直接显示整行，光标不闪。
import { reducedMotion } from "./util";

export const TERMINAL_LINE = "$ git merge --no-ff your-first-contribution";

export function startTerminal(root: HTMLElement) {
  const text = root.querySelector<HTMLElement>(".term-text")!;
  if (reducedMotion()) {
    text.textContent = TERMINAL_LINE;
    root.classList.add("is-done");
    return;
  }
  let index = 0;
  const type = () => {
    index++;
    text.textContent = TERMINAL_LINE.slice(0, index);
    if (index < TERMINAL_LINE.length) {
      // 命令名后面停一下，像人在想下一个参数
      const pause = TERMINAL_LINE[index - 1] === " " ? 120 : 38 + Math.random() * 46;
      setTimeout(type, pause);
    } else {
      root.classList.add("is-done");
    }
  };
  setTimeout(type, 900);
}
