// 比赛详情顶部的 Hero（#239）：背景和比赛官网（#278）首屏同一套浅色（ContestGlow：暖白底、彩色柔光、流动的透视网格），
// 系统开了「减少动态效果」时停住。上面压着类型与状态、渐变色的比赛名、一句介绍、到下一个节点（报名截止 / 开赛 / 结束）的倒计时，
// 以及一键直达的主按钮（由 CompetitionDetail 传进来）。
import { useEffect, useState, type ReactNode, type Ref } from "react";
import Icon from "../../Icon";
import type { Competition } from "../../../lib/competitions";
import { pointLabel } from "../../../lib/competitionLabels";
import { countdown, countdownText, nextMilestone } from "../../../lib/competitionHub";
import ContestGlow from "./ContestBackdrop";

/** 介绍的第一段：Hero 上只放一两行，全文在「概览」里。 */
export function leadOf(description: string): string {
  return description.trim().split(/\n/)[0]?.trim() ?? "";
}

const pad = (value: number) => String(value).padStart(2, "0");

/** 倒计时自己每秒走一次，只重画这一小块。读屏念 aria-label（到分钟），不念跳动的数字。 */
function Countdown({ item }: { item: Competition }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const next = nextMilestone(item, now);
  if (!next) {
    return (
      <p className="pt-cx-clock is-over">
        <span>比赛已结束</span>
        <b>{pointLabel(item.end_at, now)}</b>
      </p>
    );
  }
  const { days, hours, minutes, seconds } = countdown(next.at, now);
  return (
    <div className="pt-cx-clock" role="timer" aria-label={`距${next.label}${countdownText(next.at, now)}`}>
      <span aria-hidden="true">距{next.label}还有</span>
      <span className="pt-cx-digits" aria-hidden="true">
        <b>{days}</b>
        <small>天</small>
        <b>{pad(hours)}</b>
        <small>时</small>
        <b>{pad(minutes)}</b>
        <small>分</small>
        <b>{pad(seconds)}</b>
        <small>秒</small>
      </span>
    </div>
  );
}

type Props = {
  item: Competition;
  headingId: string;
  /** 手机进详情时把焦点给标题，读屏先念比赛名。 */
  headingRef?: Ref<HTMLHeadingElement>;
  /** 类型、状态、参赛形式、官网这一排小标签。 */
  tags: ReactNode;
  /** 一键直达的主按钮；手机上不传（主按钮在底部操作条）。 */
  cta?: ReactNode;
};

export default function CompetitionHero({ item, headingId, headingRef, tags, cta }: Props) {
  const lead = leadOf(item.description);
  return (
    <header className={`pt-cx-hero pt-cx-light is-${item.kind}`}>
      <ContestGlow />
      <div className="pt-cx-hero-art" aria-hidden="true">
        <Icon name={item.kind === "internal" ? "code-s-slash-line" : "trophy-line"} size={128} />
      </div>
      <div className="pt-cx-hero-tags">{tags}</div>
      <h3 id={headingId} ref={headingRef} tabIndex={-1}>
        <span className="pt-cx-grad">{item.name}</span>
      </h3>
      {lead && <p className="pt-cx-hero-lead">{lead}</p>}
      <div className="pt-cx-hero-foot">
        <Countdown item={item} />
        {cta}
      </div>
    </header>
  );
}
