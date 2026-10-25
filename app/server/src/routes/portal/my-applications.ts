import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/require-auth.js";

type ApplicationRow = { id: string; status: string; created_at: number };

/**
 * 我的投递状态（#277，geek apply status）：`applications` 表没有 account_id（投递在注册之前，
 * 本来就不认账号），按账号已绑定的登录邮箱（`identities` 表 provider='email' 的那些行，绑定时已经
 * 用 normalizeEmail() 存成小写）去配 `applications.email`（投递时原样保存，大小写不定，这里按小写
 * 比较，避免大小写不同被当成没投过）；一个账号没绑过邮箱就直接回空列表，不去猜、不报错。只回
 * id、status、created_at——不回姓名、班级、邮箱、特长，命令行本来就拿不到这些（#277 的硬约束）。
 */
export default async function myApplicationsRoutes(app: FastifyInstance) {
  const db = app.services.storage.db;
  const emailsOf = db.prepare("SELECT provider_uid FROM identities WHERE user_id = ? AND provider = 'email'");
  const byEmail = db.prepare("SELECT id, status, created_at FROM applications WHERE LOWER(email) = ? ORDER BY created_at DESC");

  app.get("/api/me/applications", { preHandler: requireAuth }, async (req) => {
    const emails = (emailsOf.all(req.session!.account_id) as { provider_uid: string }[]).map(row => row.provider_uid);
    if (emails.length === 0) return { applications: [] };
    const seen = new Set<string>();
    const applications: ApplicationRow[] = [];
    for (const email of emails) {
      for (const row of byEmail.all(email) as ApplicationRow[]) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        applications.push(row);
      }
    }
    applications.sort((a, b) => b.created_at - a.created_at);
    return { applications };
  });
}
