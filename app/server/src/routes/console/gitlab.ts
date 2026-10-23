import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireCapability } from "../../middleware/require-capability.js";

/**
 * GitLab 账号同步的状态与重试（#270）：每个极客班账号对应的 GitLab 用户名、用户 id、状态、组权限和最后一次错误，
 * 以及现在还要做什么（dry-run 时就是「会做什么」）。读和成员页同一组能力；重试只给能管理称号的人。
 */
export default async function consoleGitlabRoutes(app: FastifyInstance) {
  const { gitlab, config } = app.services;
  app.addHook("preHandler", requireAuth);

  app.get("/api/console/gitlab/accounts", { preHandler: requireCapability("roles.manage", "roles.department.manage") }, async () => ({
    mode: gitlab.mode, gitlab_url: config.gitlab.url, group: config.gitlab.group, accounts: gitlab.status(),
  }));

  app.post<{ Params: { account_id: string } }>("/api/console/gitlab/accounts/:account_id/sync", { preHandler: requireCapability("roles.manage"), config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (req, reply) => {
    if (gitlab.mode === "off") return reply.code(409).send({ error: "gitlab_sync_off", message: "GitLab 同步没有打开" });
    const outcome = await gitlab.syncAccount(req.params.account_id, req.session!);
    if (!outcome) return reply.code(404).send({ error: "account_not_found", message: "没有这个账号" });
    return { mode: gitlab.mode, ...outcome };
  });
}
