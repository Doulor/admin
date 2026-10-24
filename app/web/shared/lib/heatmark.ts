// 「OSS CHALLENGE」热力图字标的字形与配色（#278）：每个字母是 5×7 的点阵（热力图正好一周七行），
// 颜色沿横向从紫过渡到粉、黄、绿、蓝。第一期比赛官网首屏的 Canvas 标题（sites/contests/oss-2026-1/src/title.ts）
// 和主站比赛窗口里的静态字标（sites/portal/components/os/competitions/ContestBackdrop.tsx）共用这一份。

const GLYPHS: Record<string, readonly string[]> = {
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
  G: [".####", "#....", "#....", "#.###", "#...#", "#...#", ".###."],
};
export const GLYPH_W = 5;
export const GLYPH_H = 7;

/** 紫、粉、黄、绿、蓝：和比赛官网的五个强调色一致。 */
export const PALETTE: readonly (readonly [number, number, number])[] = [
  [123, 92, 255], [255, 79, 163], [255, 184, 28], [38, 214, 120], [41, 182, 255],
];
/** 背景格的墨色（按透明度用）。 */
export const EMPTY = [21, 19, 29] as const;

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** 沿调色板取色：t 从 0 到 PALETTE.length - 1，超出时首尾接上。 */
export function paletteAt(t: number): [number, number, number] {
  const span = PALETTE.length;
  const x = ((t % span) + span) % span;
  const i = Math.floor(x);
  const a = PALETTE[i];
  const b = PALETTE[(i + 1) % span];
  const k = x - i;
  return [mix(a[0], b[0], k), mix(a[1], b[1], k), mix(a[2], b[2], k)];
}

/** 文字排成点阵，返回字母格的 (列, 行) 与总宽。空格占 3 列，字母之间空 1 列；只认上面这几个字母。 */
export function layoutLine(text: string): { cells: [number, number][]; width: number } {
  const cells: [number, number][] = [];
  let x = 0;
  for (const ch of text) {
    if (ch === " ") { x += 3; continue; }
    const glyph = GLYPHS[ch];
    glyph.forEach((row, y) => { for (let gx = 0; gx < GLYPH_W; gx++) if (row[gx] === "#") cells.push([x + gx, y]); });
    x += GLYPH_W + 1;
  }
  return { cells, width: x - 1 };
}
