import type { FastifyInstance } from "fastify";

/**
 * 公开配置（#274 review round 1，CONTRACT-274 §8）：原来这个文件是 `/api/join/:token`——GitHub 组织邀请链接，
 * 控制台生成链接、访客填 GitHub 用户名或邮箱、服务器用 GitHub App 或发起人令牌发组织邀请；组织那道门去掉之后
 * 整条链路一起删掉（控制台生成邀请链接的管理端在 #274 阶段 1 已经删过，这里删掉剩下的公开消费端）：
 * - `GET/POST /api/join/:token`、`lib/invite-reservation.ts`（只有这个文件用）、`invite_links`/`invitations`/
 *   `invite_attempts` 三张表的读写（表本身留着给历史数据，db.ts 不改表结构）。
 * `GET /api/public/config` 和邀请链接无关（人机验证开关、工作量证明难度，官网几个表单都要用），原样留下。
 * #284 起多一个 `apply_open`：招新总开关（控制台「投递」页），官网据此在「加入我们」窗口显示表单或关闭页。
 */
export default async function publicConfigRoutes(app: FastifyInstance) {
  const { config } = app.services;
  const { powDifficulty } = app.services.publicSubmission;
  const { turnstileEnabled } = app.services.turnstile;
  const { applySettings } = app.services;
  app.get("/api/public/config", async () => ({
    turnstile_site_key: turnstileEnabled() ? config.turnstile.siteKey : null,
    pow_difficulty: powDifficulty(),
    apply_open: applySettings.isOpen(),
  }));
}
