// 比赛窗口的头图和官网入口用的浅色背景（#278，所有者 2026-10-24 16:38、16:57：比赛官网去掉暗色，入口和官网不能一深一浅）。
// 和第一期官网首屏同一套：暖白点阵底上四团慢慢漂移的彩色柔光（紫、粉、黄、绿），底部一片往前流动的透视网格；
// 颜色与样式在 styles/competitions.css 的 .pt-cx-light。系统开了「减少动态效果」时柔光和网格停住。
// HeatMark 是官网首屏标题的静态版：「OSS CHALLENGE」拼在贡献热力图上，字形与配色和官网共用 @shared/lib/heatmark。
import { memo, useId } from "react";
import { EMPTY, GLYPH_H, PALETTE, layoutLine, paletteAt } from "@shared/lib/heatmark";

function ContestGlow() {
  return (
    <div className="pt-cg" aria-hidden="true">
      <div className="pt-cg-glow">
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="pt-cg-floor">
        <i />
      </div>
    </div>
  );
}

export default memo(ContestGlow);

/** 格子坐标的确定性散列（0–1）：同一格每次一样，用来定深浅两档和背景里零星的浅色格。 */
function hash(x: number, y: number): number {
  let h = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

type LitCell = { x: number; y: number; fill: string };

/**
 * 热力图的格子：字母格两档深浅（三成浅一档，和官网定稿一样与白色混合），颜色按所在列沿调色板取；
 * 背景格大多是很淡的墨色（由图案铺满），少数深一档。四周留 `pad` 格。
 */
export function heatCells(text: string, pad = 1): { cols: number; rows: number; lit: LitCell[]; dim: { x: number; y: number }[] } {
  const line = layoutLine(text);
  const cols = line.width + pad * 2;
  const rows = GLYPH_H + pad * 2;
  const on = new Set(line.cells.map(([x, y]) => `${x + pad},${y + pad}`));
  const lit: LitCell[] = [];
  const dim: { x: number; y: number }[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const roll = hash(x, y);
      if (!on.has(`${x},${y}`)) {
        if (roll < 0.05) dim.push({ x, y });
        continue;
      }
      const strength = roll < 0.3 ? 0.86 : 1;
      const [r, g, b] = paletteAt((x / Math.max(1, cols - 1)) * (PALETTE.length - 1));
      const mix = (c: number) => Math.round(255 + (c - 255) * strength);
      lit.push({ x, y, fill: `rgb(${mix(r)},${mix(g)},${mix(b)})` });
    }
  }
  return { cols, rows, lit, dim };
}

const SIZE = 0.78;
const INSET = (1 - SIZE) / 2;
const RADIUS = SIZE * 0.24;
const ink = (alpha: number) => `rgb(${EMPTY.join(" ")} / ${alpha}%)`;

/** 「OSS CHALLENGE」热力图字标。只是装饰，读屏念外面那层的文字。字母格载入时从左到右一格格亮起来。 */
export const HeatMark = memo(function HeatMark({ text = "OSS CHALLENGE" }: { text?: string }) {
  const { cols, rows, lit, dim } = heatCells(text);
  const pattern = `pt-cx-heat-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg className="pt-cx-heat" viewBox={`0 0 ${cols} ${rows}`} aria-hidden="true" focusable="false">
      <defs>
        <pattern id={pattern} width="1" height="1" patternUnits="userSpaceOnUse">
          <rect x={INSET} y={INSET} width={SIZE} height={SIZE} rx={RADIUS} fill={ink(7)} />
        </pattern>
      </defs>
      <rect width={cols} height={rows} fill={`url(#${pattern})`} />
      {dim.map((cell) => (
        <rect key={`d${cell.x},${cell.y}`} x={cell.x + INSET} y={cell.y + INSET} width={SIZE} height={SIZE} rx={RADIUS} fill={ink(13)} />
      ))}
      {lit.map((cell) => (
        <rect
          key={`l${cell.x},${cell.y}`}
          className="is-on"
          x={cell.x + INSET}
          y={cell.y + INSET}
          width={SIZE}
          height={SIZE}
          rx={RADIUS}
          fill={cell.fill}
          style={{ animationDelay: `${cell.x * 14 + 120}ms` }}
        />
      ))}
    </svg>
  );
});
