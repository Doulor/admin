// 色调 → 实际颜色。两套独立取值（见 lib/types.ts）：
// - DeptTone（y/u/c/g/pill/ink）：部门色，取自开机动画的视觉令牌（SPEC §1）。
// - Tone（amber/cobalt/...）：状态标签的通用色，用于投递、意见等与部门无关的状态。
import type { DeptTone, Tone } from "./types";

/**
 * 部门色的色块（圆点）：字母的主体色。AI部门 = Y 青绿、算法部门 = U 蓝、硬件部门 = C 靛蓝、网安部门 = G 粉、
 * 管理部门 = --os-pill-to、无部门 = --os-ink-soft。
 */
export const DEPT_TONE_SWATCH: Record<DeptTone, string> = {
  y: "#3fd0a5", u: "#4aa6ff", c: "#8b93ff", g: "#ff83bb", pill: "#3a78f0", ink: "#5b7fb5",
};

/**
 * 部门色的文字：主体色写 11–12px 的标签字只有 2–3:1。这里取字母的描边色向墨色 #151b45 推到
 * TxTag soft（20% 底色）上 ≥4.5:1，色相不变。
 */
export const DEPT_TONE_TEXT: Record<DeptTone, string> = {
  y: "#19746b", u: "#2867c8", c: "#5056d1", g: "#aa4180", pill: "#3161c5", ink: "#4a6699",
};

const DEPT_TONES = Object.keys(DEPT_TONE_SWATCH) as DeptTone[];
/** 接口给的色调不认识或缺省时按「无部门」处理，不让页面出错。 */
export const deptTone = (tone: string | null | undefined): DeptTone => (DEPT_TONES as string[]).includes(tone ?? "") ? tone as DeptTone : "ink";

/** 状态标签色，白底 ≥5:1，本地固定。 */
export const TONE_COLOR: Record<Tone, string> = {
  amber: "#855700", cobalt: "#3346C8", violet: "#6E44C9", jade: "#18694A",
  sky: "#08609A", coral: "#A63F16", rose: "#B4235A", slate: "#5B6475",
};
export const toneColor = (tone: Tone): string => TONE_COLOR[tone];
