// 第一期比赛官网的固定配置（#278）：yzgc-site.json 由 vite.config.ts 从这里生成，页面也从这里读兜底时间，
// 两边只有这一份来源。比赛时间以公开接口为准，取不到时才用 fallback（2026-10-21 00:00 到 11-15 23:59:59，北京时间）。
import type { GradeFactor, PrizeTier, Scoring } from "../../../shared/competition-sdk";

export const SITE = {
  name: "OSS CHALLENGE 2026 第一期官网",
  version: "1.0.0",
  sdk: "competition/v1",
  competition_id: "oss-challenge-2026-1",
  fallback: {
    start_at: Date.UTC(2026, 9, 20, 16, 0, 0),
    end_at: Date.UTC(2026, 10, 15, 15, 59, 59),
  },
  /** 往哪里提交：组织者认可的 GitLab 仓库。 */
  repository: "geek/admin",
  /** 天梯与动态的刷新间隔：所有者要求几秒到十几秒内看到变化，服务端缓存 10 秒。 */
  refreshMs: 15_000,
} as const;

export function manifest() {
  return {
    name: SITE.name,
    version: SITE.version,
    sdk: SITE.sdk,
    competition_id: SITE.competition_id,
    fallback: SITE.fallback,
  };
}

const IMPORTANCE = [["normal", "一般"], ["important", "重要"], ["critical", "关键"]] as const;
const CORE = [["edge", "边缘", "文档、样式、小脚本"], ["business", "业务", "一个功能模块"], ["core", "核心", "身份、权限、数据、计分、部署"]] as const;
const TABLE = { issue: [[5, 8, 12], [8, 14, 20], [12, 20, 30]], pr: [[15, 25, 40], [25, 45, 65], [40, 65, 100]] } as const;

/**
 * 接口回来之前先显示的奖项、年级系数和两档基础分表，和服务端第一期的种子一致（tests/web/contest-site.test.ts 核对）。
 * 首屏第一眼就要看到怎么拿分、奖多少，不等接口；接口回来后一律换成接口里的值。
 */
export const FALLBACK: { prizes: PrizeTier[]; grade_factors: GradeFactor[]; scoring: Scoring } = {
  prizes: [
    { from: 1, to: 1, amount_cny: 700, title: "GPT 5x 订阅的价格" },
    { from: 2, to: 3, amount_cny: 140, title: "GPT Plus 订阅的价格" },
    { from: 4, to: 8, amount_cny: 70, title: "" },
  ],
  grade_factors: [
    { grade: "year1", label: "大一", factor: 3.5 },
    { grade: "year2", label: "大二", factor: 2.2 },
    { grade: "year3", label: "大三", factor: 1.4 },
    { grade: "year4", label: "大四", factor: 1 },
    { grade: "graduated", label: "已毕业", factor: 1 },
    { grade: "none", label: "无年级", factor: 1 },
  ],
  scoring: {
    importance: IMPORTANCE.map(([key, label]) => ({ key, label })),
    core: CORE.map(([key, label, hint]) => ({ key, label, hint })),
    points: (["issue", "pr"] as const).flatMap(kind => IMPORTANCE.flatMap(([importance], row) => CORE.map(([core], col) => ({ kind, importance, core, points: TABLE[kind][row][col] })))),
    penalty: -50,
    trivial_per_week: 1,
    trivial_percent: 0,
  },
};
