// 比赛详情（#265）：名称与状态（还剩几天、几天后开赛）、内部/外部与官网、三格要点（报名截止 / 比赛时间 / 报名方式）、
// 介绍、赛程（已过的节点标出来），底部操作条只放真能点的官网按钮。报名、组队在 #239（等统一登录 #262），这里不放。
import { useId, type Ref } from "react";
import Icon from "../../Icon";
import type { IconName } from "../../../lib/icons";
import type { Competition, CompetitionStatus } from "../../../lib/competitions";
import {
  competitionAction, deadlineFact, scheduleFact, scheduleSteps, signupFact, siteHost, statusHint, STATUS_TEXT,
  type Fact, type StepState,
} from "../../../lib/competitionLabels";

const STATUS_ICON: Record<CompetitionStatus, IconName> = {
  registering: "time-line", upcoming: "calendar-event-line", closed: "lock-line", ongoing: "pulse-line", ended: "history-line",
};
const STEP_ICON: Record<StepState, IconName> = { done: "checkbox-circle-line", now: "pulse-line", next: "circle-line", later: "circle-line" };
const STEP_NOTE: Record<StepState, string | null> = { done: "已过", now: "进行中", next: "接下来", later: null };

type Props = {
  item: Competition;
  now: number;
  /** 手机进详情时把焦点给标题，读屏先念比赛名。 */
  headingRef?: Ref<HTMLHeadingElement>;
};

function FactCell({ term, fact }: { term: string; fact: Fact }) {
  return (
    <div>
      <dt>{term}</dt>
      <dd>
        <b>{fact.main}</b>
        <span>{fact.sub}</span>
      </dd>
    </div>
  );
}

export default function CompetitionDetail({ item, now, headingRef }: Props) {
  const id = useId();
  const hint = statusHint(item, now);
  const action = competitionAction(item, now);
  return (
    <section className="pt-cx-detail" aria-labelledby={`${id}-name`}>
      <div className="pt-cx-scroll">
        <header className="pt-cx-head">
          <h3 id={`${id}-name`} ref={headingRef} tabIndex={-1}>
            {item.name}
          </h3>
          <p className={`pt-cx-pill is-${item.status}`}>
            <Icon name={STATUS_ICON[item.status]} size={15} />
            <b>{STATUS_TEXT[item.status]}</b>
            {hint && (
              <>
                <span aria-hidden="true">·</span>
                <span className="pt-sr">，</span>
                <span>{hint}</span>
              </>
            )}
          </p>
          <div className="pt-cx-tags">
            <span className={`pt-cx-kind is-${item.kind}`}>{item.kind === "internal" ? "内部赛" : "外部赛"}</span>
            {item.url && (
              <a className="pt-cx-site" href={item.url} target="_blank" rel="noopener noreferrer">
                <Icon name="global-line" size={14} />
                {siteHost(item.url)}
                <Icon name="external-link-line" size={13} />
                <span className="pt-sr">（比赛官网，新标签页打开）</span>
              </a>
            )}
          </div>
        </header>
        <dl className="pt-cx-facts">
          <FactCell term="报名截止" fact={deadlineFact(item, now)} />
          <FactCell term="比赛时间" fact={scheduleFact(item.start_at, item.end_at, now)} />
          <FactCell term="报名方式" fact={signupFact(item)} />
        </dl>
        <section className="pt-cx-sec" aria-labelledby={`${id}-about`}>
          <h4 id={`${id}-about`}>介绍</h4>
          {item.description.trim() ? <p className="pt-cx-desc">{item.description}</p> : <p className="pt-cx-none">组织者还没有写介绍。</p>}
        </section>
        <section className="pt-cx-sec" aria-labelledby={`${id}-steps`}>
          <h4 id={`${id}-steps`}>赛程</h4>
          <ol className="pt-cx-steps">
            {scheduleSteps(item, now).map((step) => (
              <li key={step.key} className={`is-${step.state}`}>
                <Icon name={STEP_ICON[step.state]} size={16} />
                <b>{step.label}</b>
                <span>{step.when}</span>
                {STEP_NOTE[step.state] && <em>{STEP_NOTE[step.state]}</em>}
              </li>
            ))}
          </ol>
        </section>
      </div>
      <footer className="pt-cx-act">
        <p>{action.text}</p>
        {action.link && (
          <a className="pt-btn is-primary" href={action.link.href} target="_blank" rel="noopener noreferrer">
            {action.link.label}
            <Icon name="external-link-line" size={15} />
            <span className="pt-sr">（新标签页打开）</span>
          </a>
        )}
      </footer>
    </section>
  );
}
