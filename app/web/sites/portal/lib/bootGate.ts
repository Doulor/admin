// 首页进站规则（SPEC §4.1）：今天（北京时间）已经播过开机动画，或者开了「减少动态效果」，直接进桌面；
// 否则播一遍。?boot=1 强制重播且不改记录（验收和录屏用），但「减少动态效果」仍然优先。
export const BOOT_DAY_KEY = "yugc:boot-day";

/** 北京时间（UTC+8，没有夏令时）的日期，YYYY-MM-DD */
export function beijingDay(at: Date = new Date()): string {
  const shifted = new Date(at.getTime() + 8 * 60 * 60 * 1000);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

export function shouldPlayBoot({ playedDay, today, reducedMotion, force }: { playedDay: string | null; today: string; reducedMotion: boolean; force: boolean }): boolean {
  if (reducedMotion) return false;
  return force || playedDay !== today;
}

export function forcedReplay(search: string): boolean {
  return new URLSearchParams(search).get("boot") === "1";
}

export function readBootDay(): string | null {
  try {
    return localStorage.getItem(BOOT_DAY_KEY);
  } catch {
    return null;
  }
}

export function writeBootDay(day: string): void {
  try {
    localStorage.setItem(BOOT_DAY_KEY, day);
  } catch {
    /* 隐私模式写不进去：只影响下次还会不会再播 */
  }
}
