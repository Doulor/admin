// 比赛列表顶上的官网入口（SPEC §4.5）：第一期比赛官网（#278）首屏的缩小版——夜空、星星、按 YUGC 四色轮换的
// 「OSS CHALLENGE」字标和一行小字，右边「打开官网」在新标签页打开这场比赛已发布的官网（`site_url`，#278）。
// 地址只来自服务端，没有发布就不显示这块，不写死地址兜底。
import Icon from "../../Icon";
import { NEW_TAB_NOTE } from "../../../lib/osApps";
import NightSky from "./NightSky";

const TONES = ["y", "u", "g", "c"] as const;
/** 每个词从 Y 开始按四色轮换（和官网首屏的标题一样） */
const WORDS = ["OSS", "CHALLENGE"].map((word) => [...word].map((letter, index) => ({ letter, tone: TONES[index % TONES.length] })));

export default function ContestSite({ href }: { href: string }) {
  return (
    <section className="pt-cx-site pt-cx-night" aria-label="比赛官网">
      <NightSky seed="oss-challenge-2026-1" count={90} />
      <div className="pt-cx-site-text">
        {/* 字标不用标题元素：窗口里的三级标题留给比赛详情 */}
        <p className="pt-cx-site-mark">
          <span className="pt-sr">OSS CHALLENGE</span>
          {WORDS.map((word, index) => (
            <span key={index} aria-hidden="true">
              {word.map((item, at) => (
                <span key={at} data-tone={item.tone}>
                  {item.letter}
                </span>
              ))}
            </span>
          ))}
        </p>
        <p className="pt-cx-site-sub">极客班开源实战贡献挑战赛 · 2026 第一期</p>
      </div>
      <a className="pt-btn is-primary" href={href} target="_blank" rel="noopener noreferrer">
        <Icon name="global-line" size={16} />
        打开官网
        <span className="pt-sr">{NEW_TAB_NOTE}</span>
      </a>
    </section>
  );
}
