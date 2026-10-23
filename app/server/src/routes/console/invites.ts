import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireCapability } from "../../middleware/require-capability.js";
import { InviteCodeError, inviteUsable, type InviteInput, type InvitePatch } from "../../lib/invite-codes.js";

/**
 * 注册邀请码（#262，所有者 2026-10-23「在我们的admin控制台再额外加个邀请码的逻辑」）：控制台列出、新建、修改、停用。
 * 授权仍按旧 Capability `accounts.invites.manage`——CONTRACT-274 §5 要求节点改成 `invite.manage`，但旧的
 * `admin` 站内角色在测试与现网都是靠 requireCapability 背后对 GitHub 组织的动态查询认出来的（见
 * tests/server/signin-methods.test.ts 的 `setup({roles:{boss:'admin'}})`），不是靠 #274 新权限体系的
 * `perm_members` 静态存储；在旧系统整体切到新系统之前单独换这一个接口的授权，"提督" 类账号会在这里丢权限
 * （已经在本地验证过这个失败模式，不是假设）。和 archiveOldDepartments() 一样，留到 requireCapability→
 * requirePermission 整体切换那一次再一起换。
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
