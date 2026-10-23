import type { LimitsService } from "./limits.js";
import type { PermissionEngine } from "./permissions.js";

export type ApplyQuota = { apply_left_today: number; apply_daily_limit: number };

/**
 * 投递每日额度（CONTRACT-274 §1「身份」/§3「投递」），`GET /auth/me` 和 `POST /api/portal/apply` 共用：
 * 上限按 `meta.limit.apply.daily` 取（账号自己的条目优先，否则命中的组里权重最高的那个，`lib/permissions.ts`
 * 的 `meta()` 已经按 SPEC §3.5 第 4 条算好），数据库里完全没有这个 meta 时按「注册用户每天 3 份」兜底
 * （SPEC §3.8）。`-1` 是不限：`apply_left_today` 也回 `-1`，不白数已经投了多少次。
 * `accountId` 为 null 是没登录的访客（`level.visitor` 的 meta 是 0）：不查 `limit_events`，直接回 0/0。
 */
export function applyQuota(deps: { permissions: Pick<PermissionEngine, "meta">; limits: Pick<LimitsService, "count"> }, accountId: string | null, now: number): ApplyQuota {
  const raw = deps.permissions.meta(accountId, "meta.limit.apply.daily");
  const max = raw === null ? (accountId === null ? 0 : 3) : Number(raw);
  if (!Number.isFinite(max) || max === -1) return { apply_left_today: -1, apply_daily_limit: -1 };
  if (accountId === null || max === 0) return { apply_left_today: 0, apply_daily_limit: max };
  const used = deps.limits.count({ bucket: "apply.daily", subject: accountId, window: "day-bj", now });
  return { apply_left_today: Math.max(0, max - used), apply_daily_limit: max };
}
