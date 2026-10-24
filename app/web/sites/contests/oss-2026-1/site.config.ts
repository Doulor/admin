// 第一期比赛官网的固定配置（#278）：yzgc-site.json 由 vite.config.ts 从这里生成，页面也从这里读兜底时间，
// 两边只有这一份来源。比赛时间以公开接口为准，取不到时才用 fallback（2026-10-21 00:00 到 11-15 23:59:59，北京时间）。
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
