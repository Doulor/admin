// 比赛官网（#278）首屏那片夜空的缩小版：深夜底色（styles/competitions.css 的 .pt-cx-night），一层按种子撒的星星，
// 少数几颗大一点、慢慢呼吸（减少动态效果时不动）。比赛详情的头图和「打开官网」横幅共用，同一个种子每次画出来一样。
import { memo } from "react";

type Star = { x: number; y: number; r: number; o: number; glow: boolean };

/** 按种子撒星星：坐标在 400×100 的画布里（SVG 按 slice 铺满，星星保持是圆的），亮的少、暗的多 */
export function scatterStars(seed: string, count: number): Star[] {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ (char.codePointAt(0) ?? 0), 16777619) >>> 0;
  const rand = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
  return Array.from({ length: count }, () => {
    const bright = rand();
    return { x: rand() * 400, y: rand() * 100, r: 0.25 + bright * bright * 0.75, o: 0.35 + bright * 0.6, glow: bright > 0.93 };
  });
}

function NightSky({ seed, count = 70 }: { seed: string; count?: number }) {
  const stars = scatterStars(seed, count);
  return (
    <svg className="pt-cx-stars" viewBox="0 0 400 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      {stars.map((star, index) => (
        <circle key={index} cx={star.x} cy={star.y} r={star.r} opacity={star.o} className={star.glow ? "is-glow" : undefined} style={star.glow ? { animationDelay: `${-(index % 7) * 0.6}s` } : undefined} />
      ))}
    </svg>
  );
}

export default memo(NightSky);
