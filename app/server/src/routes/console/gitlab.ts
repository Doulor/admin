import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/require-auth.js";
import { requirePermission } from "../../middleware/require-permission.js";
import { requireStepUp } from "../../middleware/require-step-up.js";

const PROJECTS_CACHE_KEY = "gitlab:projects";
const PROJECTS_CACHE_TTL_MS = 5 * 60_000;
const GROUP_PATH_PATTERN = /^[A-Za-z0-9_.-]{1,255}$/;

/** GitLab：账号同步的状态与重试（#270），加上控制台概览、项目列表与设置（#274，CONTRACT §6）。 */
export default async function consoleGitlabRoutes(app: FastifyInstance) {
  const { gitlab, config, cache } = app.services;
  app.addHook("preHandler", requireAuth);
  const canView = requirePermission("gitlab.view");
  const canSync = [requirePermission("gitlab.sync"), requireStepUp];
  const canSettings = requirePermission("gitlab.settings");
  const canSettingsWrite = [requirePermission("gitlab.settings"), requireStepUp];

  app.get("/api/console/gitlab/accounts", { preHandler: canView }, async () => ({
    mode: gitlab.mode, gitlab_url: config.gitlab.url, group: config.gitlab.group, client_registered: gitlab.clientRegistered(), accounts: gitlab.status(),
  }));

  app.post<{ Params: { account_id: string } }>("/api/console/gitlab/accounts/:account_id/resync", { preHandler: canSync, config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (req, reply) => {
    if (gitlab.mode === "off") return reply.code(409).send({ error: "gitlab_sync_off", message: "GitLab 同步没有打开" });
    const outcome = await gitlab.syncAccount(req.params.account_id, req.session!);
    if (!outcome) return reply.code(404).send({ error: "account_not_found", message: "没有这个账号" });
    app.services.activity.recordActivity(req, { action: "gitlab.resync", surface: "console", target_type: "account", target_id: req.params.account_id, outcome: "ok", meta: outcome });
    return { mode: gitlab.mode, ...outcome };
  });

  /** 控制台概览：同步开关、能不能连上、版本号、上一轮对账的小结、过去 24 小时还在失败状态的账号数。 */
  app.get("/api/console/gitlab/status", { preHandler: canView }, async () => {
    const { version, healthy } = await gitlab.health();
    return {
      mode: gitlab.mode, url: gitlab.url, group: gitlab.group, token_configured: config.gitlab.token !== null,
      version, healthy, last_run: gitlab.lastRun(), errors_24h: gitlab.errors24h(),
    };
  });

  /** 代码仓库应用、控制台「代码仓库」页的来源：group 本身、子组与全部项目（含私有），5 分钟缓存。 */
  app.get("/api/console/gitlab/projects", { preHandler: canView }, async () => cache.cached(PROJECTS_CACHE_KEY, PROJECTS_CACHE_TTL_MS, () => gitlab.listProjects()));

  app.get("/api/console/gitlab/settings", { preHandler: canSettings }, async () => ({
    sync_mode: gitlab.mode, group_path: gitlab.group, interval_minutes: gitlab.intervalMinutes, token_configured: config.gitlab.token !== null,
  }));

  app.patch<{ Body: { sync_mode?: "off" | "dry-run" | "on"; group_path?: string; interval_minutes?: number } }>(
    "/api/console/gitlab/settings",
    { preHandler: canSettingsWrite },
    async (req, reply) => {
      const { sync_mode, group_path, interval_minutes } = req.body;
      // interval_minutes 的 5–1440 范围已经在请求体 Schema 里校验（console/contracts.ts）；group_path 的字符规则
      // Schema 只管了长度，这里补一道 GitLab 组路径的字符规则。
      if (group_path !== undefined && !GROUP_PATH_PATTERN.test(group_path)) return reply.code(400).send({ error: "invalid_group_path", message: "group_path 必须是合法的 GitLab 组路径" });
      // 令牌只读 env：没配置时不能把 mode 打开到需要令牌的 on，否则同步只会一直失败。
      if (sync_mode === "on" && config.gitlab.token === null) return reply.code(409).send({ error: "gitlab_token_missing", message: "GITLAB_API_TOKEN 没有配置，不能打开 on" });
      if ((sync_mode === "on" || sync_mode === "dry-run") && !gitlab.url) return reply.code(409).send({ error: "gitlab_url_missing", message: "GITLAB_URL 没有配置" });
      const before = { sync_mode: gitlab.mode, group_path: gitlab.group, interval_minutes: gitlab.intervalMinutes };
      await gitlab.applySettings({ mode: sync_mode, group: group_path, intervalMinutes: interval_minutes });
      const after = { sync_mode: gitlab.mode, group_path: gitlab.group, interval_minutes: gitlab.intervalMinutes };
      app.services.activity.recordActivity(req, { action: "gitlab.settings.update", surface: "console", outcome: "ok", meta: { before, after } });
      return { ...after, token_configured: config.gitlab.token !== null };
    },
  );
}
