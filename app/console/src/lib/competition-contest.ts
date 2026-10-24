// 比赛官网、待确认贡献、计分规则与奖项、定榜、兑奖（#278）控制台页面的纯逻辑。
// 不导入 Vue，tests/console/competition-contest.test.ts 直接测。规则以服务端 competition-contract.ts 为准，
// 这里只做提交前的基本校验，服务端的错误码与中文 message 照样由 ErrorAlert 显示。
import { ApiError } from "./http";
import { SCORE_POINTS } from "./competition-hub";
import type { CandidateStatus, CollectRun, CompetitionRules, GradeKey, PrizeTier, SiteVersion } from "./types";

export const GRADE_KEYS: GradeKey[] = ["year1", "year2", "year3", "year4", "graduated", "none"];
export const GRADE_TEXT: Record<GradeKey, string> = { year1: "大一", year2: "大二", year3: "大三", year4: "大四", graduated: "已毕业", none: "无年级" };

const pad = (value: number) => String(value).padStart(2, "0");
/** 北京时间的 `MM-DD HH:mm`。 */
function shortTime(at: number): string {
  const d = new Date(at + 8 * 3600_000);
  return `${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
const isInteger = (value: string) => /^\d+$/.test(value.trim());

// —— 计分规则与奖项 ——

/** 系数存的是百分数（150 = 1.5），表单里写小数。 */
export const factorText = (percent: number) => (percent / 100).toFixed(2).replace(/0$/, "");

export type PrizeRow = { from: string; to: string; amount: string; title: string };
export type RulesForm = { factors: Record<GradeKey, string>; prizes: PrizeRow[]; projects: string };

export function rulesForm(rules: Pick<CompetitionRules, "grade_factors" | "prizes" | "gitlab_projects">): RulesForm {
  return {
    factors: Object.fromEntries(GRADE_KEYS.map(key => [key, factorText(rules.grade_factors[key] ?? 100)])) as Record<GradeKey, string>,
    prizes: rules.prizes.map(tier => ({ from: String(tier.from), to: String(tier.to), amount: String(tier.amount_cny), title: tier.title })),
    projects: rules.gitlab_projects.join("\n"),
  };
}

export const emptyPrizeRow = (after?: PrizeRow): PrizeRow => {
  const next = after && isInteger(after.to) ? String(Number(after.to) + 1) : "1";
  return { from: next, to: next, amount: "", title: "" };
};

/** 与服务端 rulesBody 同一条：GitLab 项目路径，两到五段。 */
export const GITLAB_PROJECT_PATTERN = /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+){1,4}$/;
const projectList = (text: string) => text.split(/[\s,，]+/).map(line => line.trim()).filter(Boolean);

export type RulesErrors = { factors: Partial<Record<GradeKey, string>>; prizes: string[]; prizeOrder?: string; projects?: string };
export const rulesValid = (errors: RulesErrors) =>
  !Object.keys(errors.factors).length && !errors.prizes.some(Boolean) && !errors.prizeOrder && !errors.projects;

/**
 * 逐项校验：系数 0.5–3（最多两位小数）；每档奖项名次 1–100、从小到大不重叠、金额 0–100000 的整数、说明 ≤ 40 字，
 * 最多 20 档；GitLab 项目最多 10 个。
 */
export function rulesErrors(form: RulesForm): RulesErrors {
  const errors: RulesErrors = { factors: {}, prizes: [] };
  for (const key of GRADE_KEYS) {
    const value = form.factors[key].trim();
    if (!/^\d+(?:\.\d{1,2})?$/.test(value) || Number(value) < 0.5 || Number(value) > 3) errors.factors[key] = "填 0.5 到 3 之间的数，最多两位小数。";
  }
  let previous = 0;
  form.prizes.forEach((row, index) => {
    const from = row.from.trim(), to = row.to.trim(), amount = row.amount.trim();
    let message = "";
    if (!isInteger(from) || !isInteger(to) || Number(from) < 1 || Number(to) > 100) message = "名次要填 1 到 100 的整数。";
    else if (Number(from) > Number(to)) message = "起始名次不能大于结束名次。";
    else if (Number(from) <= previous) message = "名次要接着上一档往后排，不能重叠。";
    else if (!isInteger(amount) || Number(amount) > 100_000) message = "金额要填 0 到 100000 的整数（元）。";
    else if ([...row.title.trim()].length > 40) message = "说明最多 40 个字。";
    errors.prizes[index] = message;
    if (isInteger(to)) previous = Math.max(previous, Number(to));
  });
  if (form.prizes.length > 20) errors.prizeOrder = "奖项最多 20 档。";
  const projects = projectList(form.projects);
  if (projects.length > 10) errors.projects = "最多 10 个项目。";
  else if (projects.some(path => !GITLAB_PROJECT_PATTERN.test(path) || path.length > 255)) errors.projects = "每行一个项目路径，例如 geek/admin。";
  return errors;
}

export type RulesPayload = { grade_factors: Record<GradeKey, number>; prizes: PrizeTier[]; gitlab_projects: string[] };
export function rulesPayload(form: RulesForm): RulesPayload {
  return {
    grade_factors: Object.fromEntries(GRADE_KEYS.map(key => [key, Math.round(Number(form.factors[key].trim()) * 100)])) as Record<GradeKey, number>,
    prizes: form.prizes.map(row => ({ from: Number(row.from.trim()), to: Number(row.to.trim()), amount_cny: Number(row.amount.trim()), title: row.title.trim() })),
    gitlab_projects: [...new Set(projectList(form.projects))],
  };
}

/** 奖项一档的写法：「第 1 名 · 700 元」「第 4–8 名 · 70 元」。 */
export function prizeText(tier: Pick<PrizeTier, "from" | "to" | "amount_cny">): string {
  return `${tier.from === tier.to ? `第 ${tier.from} 名` : `第 ${tier.from}–${tier.to} 名`} · ${tier.amount_cny} 元`;
}

// —— 待确认贡献 ——

export const CANDIDATE_STATUS_TEXT: Record<CandidateStatus, string> = { pending: "待确认", accepted: "已加分", rejected: "已驳回" };
export const CANDIDATE_KIND_TEXT: Record<"pr" | "issue", string> = { pr: "MR", issue: "Issue" };

/** 确认时可以改分：落在这种记录的区间里（Issue 5–30、MR 15–100），默认是建议分。 */
export function acceptPointsError(kind: "pr" | "issue", points: string): string | null {
  const { min, max } = SCORE_POINTS[kind];
  const value = points.trim();
  return isInteger(value) && Number(value) >= min && Number(value) <= max ? null : `分值要填 ${min}–${max} 的整数。`;
}

/** 收集的一句话结果；`last_run` 只记在服务端进程里，重启后是 null。 */
export function collectSummary(run: CollectRun | null): string {
  if (!run) return "服务启动后还没有收集过。GitLab 同步打开时每 10 分钟收一轮，也可以点「立即收集」。";
  const head = `${shortTime(run.at)} 收集`;
  if (run.error) return `${head}没有完成：${run.error}`;
  return `${head}：读了 ${run.fetched} 条，新增 ${run.created} 条，跳过 ${run.skipped} 条，按标签加分 ${run.accepted} 条，撤销 ${run.revoked} 条。`;
}

// —— 官网 ——

export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{2,31}$/;
export const SITE_MAX_BYTES = 20 * 1024 * 1024;

export function slugError(slug: string): string | null {
  return SLUG_PATTERN.test(slug.trim()) ? null : "地址用 3–32 个小写字母、数字或连字符，不能以连字符开头。";
}

/** 选的文件能不能上传：要是 .zip、不超过 20MB；里面的内容由服务端校验。 */
export function siteFileError(file: { name: string; size: number }): string | null {
  if (!/\.zip$/i.test(file.name)) return "要选 .zip 文件（用 pnpm contest:site pack 打包）。";
  if (file.size > SITE_MAX_BYTES) return `文件 ${fmtBytes(file.size)}，超过 20MB 的上限。`;
  return null;
}

export function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** 版本的状态：在线、通过（可发布）、没通过。 */
export function versionState(version: Pick<SiteVersion, "id" | "status">, liveId: string | null): { text: string; tone: "success" | "info" | "danger" } {
  if (version.id === liveId) return { text: "在线", tone: "success" };
  return version.status === "passed" ? { text: "通过", tone: "info" } : { text: "没通过", tone: "danger" };
}

/**
 * 上传被拒（422 site_rejected）时服务端给逐条原因；被网关按大小拒收（413，宿主 nginx 整站 6m，见 DEPLOY）时说一句；
 * 别的错误交给 ErrorAlert。
 */
export function rejectReport(error: unknown): string[] | null {
  if (error instanceof ApiError && error.status === 413) return ["文件超过了网关允许的上传大小，没有传到服务端（HTTP 413）。"];
  if (!(error instanceof ApiError) || error.code !== "site_rejected") return null;
  const report = error.payload?.report;
  return Array.isArray(report) ? report.filter((line): line is string => typeof line === "string") : [];
}

// —— 兑奖 ——

/** 与服务端 normalizePrizeCode 同一套：不分大小写，空格、连字符与 YUGC 前缀可有可无，I、L 当 1，O 当 0。 */
export function normalizeCode(input: string): string | null {
  let text = input.toUpperCase().replace(/[\s-]+/g, "");
  if (text.startsWith("YUGC")) text = text.slice(4);
  text = text.replace(/[IL]/g, "1").replace(/O/g, "0");
  return /^[0-9A-HJKMNP-TV-Z]{16}$/.test(text) ? text : null;
}

export function codeError(input: string): string | null {
  if (!input.trim()) return "请输入兑奖码。";
  return normalizeCode(input) ? null : "兑奖码是 YUGC 加 16 位字母和数字，例如 YUGC-7K2M-9QXA-4T8B-R3NW。";
}

/** 查找、核销失败时的说明：查不到、已经核销过、输错太多次分开说；其余（要重新登录、没有权限）交给 ErrorAlert。 */
export function redeemFailure(error: unknown): { text: string; prize: unknown } | null {
  if (!(error instanceof ApiError)) return null;
  if (error.code === "code_not_found") return { text: "没有这个兑奖码。核对一下有没有输错，输错的次数每小时最多 20 次。", prize: null };
  if (error.code === "already_redeemed") return { text: "这个兑奖码已经核销过了，不能再兑一次。", prize: error.payload?.prize ?? null };
  if (error.status === 429) return { text: "输错的兑奖码太多了，一小时后再试。", prize: null };
  return null;
}
