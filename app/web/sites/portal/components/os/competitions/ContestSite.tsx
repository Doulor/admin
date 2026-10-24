// 比赛列表顶上的官网入口（SPEC §4.5）：第一期比赛官网（#278）首屏的缩小版——暖白底、彩色柔光和流动的透视网格（ContestGlow），
// 贡献热力图拼出的「OSS CHALLENGE」（HeatMark）、渐变色的比赛名和一行小字，右边「打开官网」在新标签页打开这场比赛已发布的官网（`site_url`，#278）。
// 地址只来自服务端，没有发布就不显示这块，不写死地址兜底。
import Icon from "../../Icon";
import { NEW_TAB_NOTE } from "../../../lib/osApps";
import ContestGlow, { HeatMark } from "./ContestBackdrop";

export default function ContestSite({ href }: { href: string }) {
  return (
    <section className="pt-cx-site pt-cx-light" aria-label="比赛官网">
      <ContestGlow />
      <div className="pt-cx-site-text">
        {/* 字标不用标题元素：窗口里的三级标题留给比赛详情 */}
        <p className="pt-cx-site-mark">
          <span className="pt-sr">OSS CHALLENGE</span>
          <HeatMark />
        </p>
        <p className="pt-cx-site-name">
          <span className="pt-cx-grad">极客班开源实战贡献挑战赛</span>
          <span className="pt-cx-site-sub">第一届内部赛 · 2026 第一期</span>
        </p>
      </div>
      <a className="pt-btn is-hero" href={href} target="_blank" rel="noopener noreferrer">
        <Icon name="global-line" size={16} />
        打开官网
        <span className="pt-sr">{NEW_TAB_NOTE}</span>
      </a>
    </section>
  );
}
