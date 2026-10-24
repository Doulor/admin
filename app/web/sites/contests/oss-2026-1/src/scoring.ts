// 计分规则（#278，所有者 2026-10-24 16:59）：两张基础分表（重要程度 × 核心度，Issue 和 MR 各一张，格子按分值深浅上色）、
// 年级系数柱、「算一算」和首屏那几句说明。都从公开比赛对象的 scoring 与 grade_factors 画；
// 接口回来之前用 site.config.ts 的 FALLBACK，所以首屏和这一段不用等接口。
import type { Core, GradeFactor, Importance, PrizeTier, Scoring } from "@shared/competition-sdk";
import { iconSvg } from "./icons";
import { escapeHtml, rollNumber } from "./util";

type Kind = "issue" | "pr";
const KINDS: Kind[] = ["issue", "pr"];
const KIND_TEXT: Record<Kind, string> = { issue: "Issue", pr: "MR" };

/** 3.5 → 「3.5」，1 → 「1.0」，1.25 → 「1.25」。 */
export const formatFactor = (factor: number) => (Number.isInteger(Math.round(factor * 100) / 10) ? factor.toFixed(1) : String(Math.round(factor * 100) / 100));

export function pointsOf(scoring: Scoring, kind: Kind, importance: Importance, core: Core): number {
  return scoring.points.find(item => item.kind === kind && item.importance === importance && item.core === core)?.points ?? 0;
}

function pointsRange(scoring: Scoring, kind: Kind): [number, number] {
  const values = scoring.points.filter(item => item.kind === kind).map(item => item.points);
  return values.length ? [Math.min(...values), Math.max(...values)] : [0, 0];
}

/** 加权分：和服务端一样按百分数整数算再四舍五入（45 × 3.5 = 157.5 记 158）。 */
export const weighted = (points: number, factor: number) => Math.round((points * Math.round(factor * 100)) / 100);

/** 末尾系数相同的几档合成「其余」：大一 ×3.5 · 大二 ×2.2 · 大三 ×1.4 · 其余 ×1.0 */
export function gradeLine(grades: GradeFactor[]): string {
  if (grades.length === 0) return "";
  let tail = grades.length - 1;
  while (tail > 0 && grades[tail - 1].factor === grades[grades.length - 1].factor) tail--;
  const head = grades.length - tail >= 2 ? grades.slice(0, tail) : grades;
  const parts = head.map(item => `${item.label} ×${formatFactor(item.factor)}`);
  if (head.length < grades.length) parts.push(`其余 ×${formatFactor(grades[grades.length - 1].factor)}`);
  return parts.join(" · ");
}

/** 拿来对比的那一档：大四（没有时取最后一档）。 */
const senior = (grades: GradeFactor[]) => grades.find(item => item.grade === "year4") ?? grades[grades.length - 1];

export function trivialRule(scoring: Scoring): string {
  const normal = scoring.importance[0]?.label ?? "一般";
  const edge = scoring.core[0]?.label ?? "边缘";
  const after = scoring.trivial_percent === 0 ? "后面的记 0 分" : `后面的按 ${scoring.trivial_percent}% 算`;
  return `防刷：每人每周「${normal} × ${edge}」只算 ${scoring.trivial_per_week} 条，${after}，记录照留。`;
}

/** 首屏「怎么拿分」第二、三步与常见问题里随规则变的句子。 */
export function renderScoringTexts(scoring: Scoring, grades: GradeFactor[]) {
  const [issueMin, issueMax] = pointsRange(scoring, "issue");
  const [prMin, prMax] = pointsRange(scoring, "pr");
  const set = (key: string, text: string) => {
    for (const node of document.querySelectorAll<HTMLElement>(`[data-text="${key}"]`)) node.textContent = text;
  };
  set("how-points", `按重要程度 × 核心度查表：Issue ${issueMin}–${issueMax} 分，MR ${prMin}–${prMax} 分，不看代码行数`);
  set("how-grades", gradeLine(grades));
  set("trivial-rule", trivialRule(scoring));
  const first = grades[0];
  const last = senior(grades);
  if (first && last) {
    const ratio = formatFactor(first.factor / last.factor).replace(/\.0$/, "");
    const top = scoring.importance[scoring.importance.length - 1];
    const core = scoring.core[scoring.core.length - 1];
    const topPoints = top && core ? pointsOf(scoring, "pr", top.key, core.key) : prMax;
    set("faq-grade", `这场比赛想鼓励刚入门的同学，所以低年级系数高：${first.label} ×${formatFactor(first.factor)}，同样一条贡献，${first.label}拿到的分是${last.label}的 ${ratio} 倍。`
      + `高年级做出关键、核心的贡献，基础分本来就高，${top?.label ?? "关键"} × ${core?.label ?? "核心"}的 MR 是 ${topPoints} 分。`);
  }
}

/** 两张基础分表：行是重要程度，列是核心度，格子颜色按分值占这张表最高分的比例。 */
export function renderRubric(slot: HTMLElement, legend: HTMLElement, scoring: Scoring) {
  const tables = KINDS.map(kind => {
    const [min, max] = pointsRange(scoring, kind);
    const head = scoring.core.map(core => `<th scope="col">${escapeHtml(core.label)}</th>`).join("");
    let index = 0;
    const rows = scoring.importance.map(importance => `<tr><th scope="row">${escapeHtml(importance.label)}</th>${scoring.core.map(core => {
      const points = pointsOf(scoring, kind, importance.key, core.key);
      return `<td><span class="heat" data-cell="${kind}:${importance.key}:${core.key}" style="--h:${(points / Math.max(1, max)).toFixed(3)};--d:${(index++ * 0.05).toFixed(2)}s">${points}</span></td>`;
    }).join("")}</tr>`).join("");
    return `<figure class="card rubric-card tone-${kind === "pr" ? "violet" : "lime"}">
        <figcaption>${iconSvg(kind === "pr" ? "git-pull-request-line" : "bug-line")}<span>${kind === "pr" ? "合入的 MR" : "Issue"}</span><small>${min}–${max} 分 · 行是重要程度，列是核心度</small></figcaption>
        <table class="rubric-table">
          <caption class="sr-only">${KIND_TEXT[kind]} 的基础分：行是重要程度，列是核心度</caption>
          <thead><tr><td></td>${head}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </figure>`;
  }).join("");
  slot.innerHTML = tables;
  legend.innerHTML = scoring.core.map(core => `<span>${escapeHtml(core.label)}：${escapeHtml(core.hint)}</span>`).join("");
}

/** 年级系数画成柱子：高度按系数相对最大值，柱顶写系数。 */
export function renderGradeFactors(list: HTMLElement, grades: GradeFactor[]) {
  if (grades.length === 0) return;
  const max = Math.max(...grades.map(item => item.factor));
  list.innerHTML = grades
    .map(item => `<li style="--k:${(item.factor / max).toFixed(3)}"><b>×${formatFactor(item.factor)}</b><i aria-hidden="true"></i><span>${escapeHtml(item.label)}</span></li>`).join("");
}

type Pick = { kind: Kind; importance: Importance; core: Core; grade: string };

/**
 * 「算一算」：选种类、两档和年级，马上算出这一条记多少分；选中的那一格在上面的表里亮起来。
 * 全是原生单选框，方向键在一组里切换。比赛数据刷新时只在规则真的变了才重画，选中的不丢。
 */
export function createCalc(root: HTMLElement, rubric: HTMLElement) {
  const groups = root.querySelector<HTMLElement>(".calc-groups")!;
  const out = root.querySelector<HTMLElement>(".calc-out")!;
  const note = root.querySelector<HTMLElement>(".calc-note")!;
  let scoring: Scoring | null = null;
  let grades: GradeFactor[] = [];
  let signature = "";
  let pick: Pick = { kind: "pr", importance: "important", core: "business", grade: "year1" };

  const group = (name: keyof Pick, legend: string, options: { value: string; label: string }[]) => `<fieldset class="seg">
      <legend>${legend}</legend>
      <div class="seg-opts">${options.map(option => `<label><input type="radio" name="calc-${name}" value="${escapeHtml(option.value)}"${pick[name] === option.value ? " checked" : ""} /><span>${escapeHtml(option.label)}</span></label>`).join("")}</div>
    </fieldset>`;

  function compute() {
    if (!scoring) return;
    const base = pointsOf(scoring, pick.kind, pick.importance, pick.core);
    const grade = grades.find(item => item.grade === pick.grade) ?? grades[0];
    const factor = grade?.factor ?? 1;
    const total = weighted(base, factor);
    out.innerHTML = `<span class="calc-formula">${base} × ${formatFactor(factor)}</span><span class="calc-eq">=</span><span class="calc-total"><b class="score">${total}</b> 分</span>`;
    const node = out.querySelector<HTMLElement>(".score")!;
    node.dataset.value = out.dataset.last ?? String(total);
    rollNumber(node, total, 600);
    out.dataset.last = String(total);
    const trivial = pick.importance === scoring.importance[0]?.key && pick.core === scoring.core[0]?.key;
    const last = senior(grades);
    note.textContent = trivial
      ? trivialRule(scoring).replace(/^防刷：/, "")
      : last && grade && last.grade !== grade.grade ? `同样一条，${last.label}同学是 ${weighted(base, last.factor)} 分。` : `${KIND_TEXT[pick.kind]} 的基础分 ${base}，乘年级系数后记 ${total} 分。`;
    for (const cell of rubric.querySelectorAll<HTMLElement>(".heat")) cell.classList.toggle("is-pick", cell.dataset.cell === `${pick.kind}:${pick.importance}:${pick.core}`);
  }

  groups.addEventListener("change", event => {
    const input = event.target as HTMLInputElement;
    const key = input.name.replace(/^calc-/, "") as keyof Pick;
    pick = { ...pick, [key]: input.value };
    compute();
  });

  return {
    update(nextScoring: Scoring, nextGrades: GradeFactor[]) {
      const next = JSON.stringify([nextScoring, nextGrades]);
      if (next === signature) return;
      signature = next;
      scoring = nextScoring;
      grades = nextGrades;
      if (!grades.some(item => item.grade === pick.grade)) pick = { ...pick, grade: grades[0]?.grade ?? "" };
      groups.innerHTML = group("kind", "种类", KINDS.map(kind => ({ value: kind, label: KIND_TEXT[kind] })))
        + group("importance", "重要程度", scoring.importance.map(item => ({ value: item.key, label: item.label })))
        + group("core", "核心度", scoring.core.map(item => ({ value: item.key, label: item.label })))
        + group("grade", "年级", grades.map(item => ({ value: item.grade, label: item.label })));
      compute();
    },
  };
}

/** 奖金一共多少、发到第几名。 */
export function prizeTotal(prizes: PrizeTier[]): { total: number; through: number } {
  return {
    total: prizes.reduce((sum, tier) => sum + tier.amount_cny * (tier.to - tier.from + 1), 0),
    through: prizes.reduce((max, tier) => Math.max(max, tier.to), 0),
  };
}
