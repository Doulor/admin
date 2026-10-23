import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requireAuth } from "../../middleware/require-auth.js";
import { requirePermission } from "../../middleware/require-permission.js";
import { ACCOUNT_AVATAR_BYTES_MAX, ACCOUNT_AVATAR_TYPES, AccountAvatarError, processAccountAvatar } from "../../lib/account-avatar.js";
import { redeemInvite } from "../../lib/invite-codes.js";
import { setExclusiveGroupMembership } from "../../lib/permissions.js";

const byAccount = (req: FastifyRequest) => req.session!.account_id;

/**
 * 账号资料、头像与邀请码兑换（#274 CONTRACT-274 §2）。资料和头像统一存 account_profiles/account_avatars，
 * 论坛、控制台、GitLab 同步、OIDC userinfo、命令行都读这里，不再各自存一份。
 */
export default async function identityProfileRoutes(app: FastifyInstance) {
  const { profiles, storage, permissions } = app.services;
  const db = storage.db;

  app.get("/api/identity/profile", { preHandler: requireAuth }, async req => profiles.get(req.session!.account_id));

  app.patch<{ Body: { display_name?: string; bio?: string; username?: string; prefs?: Record<string, unknown> } }>(
    "/api/identity/profile",
    { preHandler: requirePermission("account.profile.edit"), config: { rateLimit: { max: 30, timeWindow: "1 hour", keyGenerator: byAccount, hook: "preHandler" } } },
    async (req, reply) => {
      const result = profiles.update(req.session!.account_id, req.body);
      if (!result.ok) return reply.code(409).send({ error: "username_taken", message: "这个用户名已经被用了" });
      storage.audit(null, req.session!, "profile.update", undefined, { fields: Object.keys(req.body) }, req.ip);
      return result.profile;
    },
  );

  app.get<{ Params: { file: string } }>("/api/identity/avatar/:file", async (req, reply) => {
    const data = profiles.avatar(req.params.file.slice(0, -".webp".length));
    if (!data) return reply.code(404).send({ error: "not_found", message: "头像不存在" });
    return reply
      .header("Content-Type", "image/webp")
      .header("Cache-Control", "public, max-age=31536000, immutable")
      .header("Content-Security-Policy", "default-src 'none'")
      .send(data);
  });

  // 头像上传：请求体就是图片本身，不走 JSON；只在这个子作用域里接收任意类型的原始请求体。
  await app.register(async avatarApp => {
    avatarApp.addContentTypeParser("*", { parseAs: "buffer", bodyLimit: ACCOUNT_AVATAR_BYTES_MAX }, (_req, body, done) => done(null, body));
    const tooLarge = (error: { code?: string }, _req: FastifyRequest, reply: FastifyReply) => {
      if (error.code === "FST_ERR_CTP_BODY_TOO_LARGE") return reply.code(413).send({ error: "avatar_too_large", message: "头像不能超过 2MB" });
      throw error;
    };
    avatarApp.put(
      "/api/identity/avatar",
      { preHandler: requirePermission("account.profile.edit"), errorHandler: tooLarge, config: { rateLimit: { max: 10, timeWindow: "1 hour", keyGenerator: byAccount, hook: "preHandler" } } },
      async (req, reply) => {
        const type = String(req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
        if (!(ACCOUNT_AVATAR_TYPES as readonly string[]).includes(type) || !Buffer.isBuffer(req.body)) {
          return reply.code(415).send({ error: "unsupported_media_type", message: "头像只支持 PNG、JPEG、WebP、GIF 图片" });
        }
        try {
          const { hash, data } = await processAccountAvatar(req.body as Buffer);
          profiles.setAvatar(req.session!.account_id, hash, data);
          storage.audit(null, req.session!, "profile.avatar", undefined, undefined, req.ip);
          return { avatar_url: profiles.avatarUrl(hash) };
        } catch (cause) {
          if (cause instanceof AccountAvatarError) return reply.code(cause.status).send({ error: cause.code, message: cause.message });
          throw cause;
        }
      },
    );
  });

  app.post<{ Body: { code: string } }>(
    "/api/identity/invite/redeem",
    { preHandler: requirePermission("account.invite.redeem"), config: { rateLimit: { max: 10, timeWindow: "1 hour", keyGenerator: byAccount, hook: "preHandler" } } },
    async (req, reply) => {
      const accountId = req.session!.account_id;
      const outcome = db.transaction((): { ok: true } | { ok: false; reason: "already_member" | "invite_invalid" } => {
        const alreadyMember = db.prepare("SELECT 1 FROM perm_members WHERE account_id = ? AND group_id = 'level.member'").get(accountId);
        if (alreadyMember) return { ok: false, reason: "already_member" };
        const redeemed = redeemInvite(db, req.body.code, Date.now());
        if (!redeemed.ok) return { ok: false, reason: "invite_invalid" };
        setExclusiveGroupMembership(db, accountId, "level.member", Date.now(), `invite:${redeemed.id}`);
        return { ok: true };
      })();
      if (!outcome.ok) {
        return outcome.reason === "already_member"
          ? reply.code(409).send({ error: "already_member", message: "你已经是极客班成员了" })
          : reply.code(400).send({ error: "invite_invalid", message: "邀请码无效" });
      }
      permissions.bump();
      storage.audit(null, req.session!, "invite.redeem", undefined, undefined, req.ip);
      return { level: "member" };
    },
  );
}
