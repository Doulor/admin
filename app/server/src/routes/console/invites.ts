import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireCapability } from "../../middleware/require-capability.js";
import { InviteCodeError, inviteUsable, type InviteInput, type InvitePatch } from "../../lib/invite-codes.js";

/**
 * 注册邀请码（#262，所有者 2026-10-23「在我们的admin控制台再额外加个邀请码的逻辑」）：控制台列出、新建、修改、停用。
 * 授权按 `accounts.invites.manage`（提督默认就有，其他称号由提督在「成员与权限」里放进权限包）。邀请码不删，停用即可，
 * 账号上记着是用哪个邀请码注册的。只看身份与称号，不调用 GitHub，邮箱、Google 会话照常可用。
 */
export default async function consoleInviteRoutes(app: FastifyInstance) {
  const { invites } = app.services;
  const { audit } = app.services.storage;
  app.addHook("preHandler", requireAuth);
  const manage = { preHandler: requireCapability("accounts.invites.manage") };
  const write = { ...manage, config: { rateLimit: { max: 30, timeWindow: "1 minute" } } };
  const actor = (req: { session?: { login: string; account_id: string } }) => ({ login: req.session!.login, account_id: req.session!.account_id });

  app.get("/api/console/invites", manage, async () => ({ invites: invites.list() }));

  app.post<{ Body: InviteInput }>("/api/console/invites", write, async (req, reply) => {
    try {
      const invite = invites.create(req.body, req.session!.login);
      audit(null, actor(req), "invite.create", invite.code, { id: invite.id, max_uses: invite.max_uses, expires_at: invite.expires_at }, req.ip);
      return reply.code(201).send({ ...invite, usable: inviteUsable(invite, Date.now()) });
    } catch (error) {
      if (error instanceof InviteCodeError) return reply.code(error.code === "invite_code_taken" ? 409 : 400).send({ error: error.code, message: error.message });
      throw error;
    }
  });

  app.patch<{ Params: { id: string }; Body: InvitePatch }>("/api/console/invites/:id", write, async (req, reply) => {
    const id = Number(req.params.id);
    const changed = invites.update(id, req.body);
    if (changed === null) return reply.code(404).send({ error: "not_found", message: "没有这个邀请码" });
    const invite = invites.get(id)!;
    if (changed.length) audit(null, actor(req), "invite.update", invite.code, { id, fields: changed, disabled: invite.disabled }, req.ip);
    return { ...invite, usable: inviteUsable(invite, Date.now()) };
  });
}
