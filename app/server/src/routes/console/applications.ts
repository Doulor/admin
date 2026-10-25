import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requireAuth } from "../../middleware/require-auth.js";
import { requirePermission } from "../../middleware/require-permission.js";
import { requireScopedPermission } from "../../lib/console-scope.js";
import { requireStepUp } from "../../middleware/require-step-up.js";
import { beijingCompactDate, beijingDateTime } from "../../lib/beijing-time.js";
import { APPLICATION_STATUSES, APPLICATION_STATUS_IDS, type ApplicationStatus } from "../../lib/roles.js";
import { MailTemplateError, oneLine, type RenderedMail } from "../../lib/mail/envelope.js";
import type { RecruitmentLetter } from "../../lib/mail/mailer.js";
import { TemplateStoreError } from "../../lib/mail/template-store.js";
import { renderErrorMessage, type TemplateContent } from "../../lib/mail/template-content.js";
import { csvCell, escapeLike } from "../../lib/sql-text.js";

type ApplicationRow = { id: string; name: string; class_name: string; email: string; strengths: string; status: string; created_at: number };
type ReviewRow = { id: number; application_id: string; from_status: string; to_status: string; note: string | null; reviewer: string; created_at: number };
type ListQuery = { status?: ApplicationStatus; q?: string; limit?: string; offset?: string };
type ReviewBody = { status?: string; expected_status?: ApplicationStatus; expected_review_id?: number; note?: string; notify?: boolean; template_id?: string; letter?: RecruitmentLetter };

/** 只有这三种状态发通知信；已取消、改回已收到、只写备注都不发。 */
const LETTER_STATUSES = ["interview", "accepted", "rejected"] as const;
type LetterStatus = (typeof LETTER_STATUSES)[number];
const isLetterStatus = (value: string): value is LetterStatus => (LETTER_STATUSES as readonly string[]).includes(value);

/** 列表与详情只下发这些列；来源 IP 与 User-Agent 留在服务端。 */
const APPLICATION_COLUMNS = "id, name, class_name, email, strengths, status, created_at";
const EXCERPT_LENGTH = 120;
const byAccount = (req: FastifyRequest) => req.session!.account_id;
const excerpt = (value: string) => (value.length > EXCERPT_LENGTH ? `${value.slice(0, EXCERPT_LENGTH)}…` : value);
const statusLabel = (id: string) => APPLICATION_STATUSES.find(item => item.id === id)?.label ?? id;

export default async function consoleApplicationRoutes(app: FastifyInstance) {
  const { mail, applySettings } = app.services;
  const { db } = app.services.storage;
  app.addHook("preHandler", requireAuth);

  const lastReview = db.prepare("SELECT to_status, reviewer, created_at FROM application_reviews WHERE application_id = ? ORDER BY created_at DESC, id DESC LIMIT 1");
  // 审核记录的版本号取最大的 id：id 自增，只会变大；created_at 跟着服务器时钟，时钟往回拨时最新一条不一定排第一
  const lastReviewId = db.prepare("SELECT COALESCE(MAX(id), 0) AS id FROM application_reviews WHERE application_id = ?");

  // #274 残留修复 J：部门部长只有按部门限定的 apply.view/apply.review（种子里没有任何账号持有不限定
  // 的那两个节点，除了站长的通配 `*`），requirePermission 按「不给 scope 就查全局」判定，部长一律 403，
  // 完全看不到投递——这是真实的功能性漏洞，不是权限过松。改用 requireScopedPermission 放行有部门范围
  // 的部长；但 applications 表本身没有部门列（投递在提交时不分部门，不是哪个部门的事），req.departmentScope
  // 算出来的范围这里没有字段可以拿来过滤，命中了就能看全部投递，和站长看到的一样——这不是疏漏，是因为
  // 没有可过滤的维度。
  app.get<{ Querystring: ListQuery }>("/api/console/applications", { preHandler: requireScopedPermission("apply.view") }, async (req) => {
    const { status, q } = req.query;
    const limit = Number(req.query.limit ?? 50);
    const offset = Number(req.query.offset ?? 0);
    const where: string[] = [];
    const params: unknown[] = [];
    if (status) { where.push("status = ?"); params.push(status); }
    if (q?.trim()) {
      const like = `%${escapeLike(q.trim())}%`;
      where.push("(name LIKE ? ESCAPE '\\' OR class_name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\')");
      params.push(like, like, like);
    }
    const clause = where.length ? ` WHERE ${where.join(" AND ")}` : "";
    const rows = db.prepare(`SELECT ${APPLICATION_COLUMNS} FROM applications${clause} ORDER BY created_at DESC, id LIMIT ? OFFSET ?`)
      .all(...params, limit, offset) as ApplicationRow[];
    const total = (db.prepare(`SELECT COUNT(*) AS n FROM applications${clause}`).get(...params) as { n: number }).n;
    const counts: Record<string, number> = Object.fromEntries(APPLICATION_STATUS_IDS.map(id => [id, 0]));
    for (const row of db.prepare("SELECT status, COUNT(*) AS n FROM applications GROUP BY status").all() as { status: string; n: number }[]) counts[row.status] = row.n;
    return {
      items: rows.map(row => ({
        id: row.id, name: row.name, class_name: row.class_name, email: row.email,
        strengths_excerpt: excerpt(row.strengths), status: row.status, created_at: row.created_at,
        last_review: (lastReview.get(row.id) as { to_status: string; reviewer: string; created_at: number } | undefined) ?? null,
      })),
      total, counts,
    };
  });

  // 招新总开关（#284）：读随投递列表的 apply.view（部门部长也能看到现在是开还是关），改要 apply.settings 加刚登录过。
  // 关掉以后官网「加入我们」显示关闭页、POST /api/portal/apply 回 403 apply_closed；已收到的投递和审核不受影响。
  // 状态没变（比如两个人先后点了「关闭」）回当前状态，不写库也不记操作。
  app.get("/api/console/applications/settings", { preHandler: requireScopedPermission("apply.view") }, async () => applySettings.get());

  app.patch<{ Body: { open: boolean } }>(
    "/api/console/applications/settings",
    { preHandler: [requirePermission("apply.settings"), requireStepUp], config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (req) => db.transaction(() => {
      const { settings, changed } = applySettings.setOpen(req.body.open);
      if (changed) {
        app.services.activity.recordActivity(req, {
          action: "application.settings.update", surface: "console", target_type: "application_settings", target_id: "apply_open", outcome: "ok",
          meta: { open: settings.open },
        });
      }
      return settings;
    })(),
  );

  // 静态路由优先于 /:application_id，Fastify 不会把 export.csv 当成 id。
  app.get<{ Querystring: { status?: ApplicationStatus } }>(
    "/api/console/applications/export.csv",
    { preHandler: requirePermission("apply.export"), config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const { status } = req.query;
      const rows = (status
        ? db.prepare(`SELECT ${APPLICATION_COLUMNS} FROM applications WHERE status = ? ORDER BY created_at DESC`).all(status)
        : db.prepare(`SELECT ${APPLICATION_COLUMNS} FROM applications ORDER BY created_at DESC`).all()) as ApplicationRow[];
      // 投递时间和文件名里的日期按北京时间写（lib/beijing-time.ts），和控制台页面、信里的时间一致；列名写明是北京时间。
      const header = ["name", "class_name", "email", "strengths", "status", "created_at_beijing"];
      const lines = [header.join(","), ...rows.map(row => [row.name, row.class_name, row.email, row.strengths, row.status, beijingDateTime(row.created_at)].map(csvCell).join(","))];
      app.services.activity.recordActivity(req, { action: "application.export", surface: "console", target_type: "application_status", target_id: status ?? "all", outcome: "ok", meta: { count: rows.length, status: status ?? null } });
      return reply
        .header("Content-Type", "text/csv; charset=utf-8")
        .header("Content-Disposition", `attachment; filename="applications-${beijingCompactDate(Date.now())}.csv"`)
        .send(`﻿${lines.join("\r\n")}\r\n`);
    },
  );

  const findApplication = (id: string) => db.prepare(`SELECT ${APPLICATION_COLUMNS} FROM applications WHERE id = ?`).get(id) as ApplicationRow | undefined;
  const reviewsOf = (id: string) => db.prepare("SELECT id, from_status, to_status, note, reviewer, created_at FROM application_reviews WHERE application_id = ? ORDER BY created_at DESC, id DESC").all(id) as Omit<ReviewRow, "application_id">[];
  /** 审核记录带上那次改状态发的信（没发信的是 null） */
  const withMail = <T extends { id: number }>(reviews: T[]) => {
    const summaries = mail.reviewSummaries(reviews.map(review => review.id));
    return reviews.map(review => ({ ...review, mail: summaries.get(review.id) ?? null }));
  };

  const letterTemplates = () => {
    const { interview, accepted, rejected } = mail.templates.enabledOptions();
    return { interview, accepted, rejected };
  };
  /** 选这次要发的信：不指定用这一类的默认；指定了必须存在、是这一类、已启用。选不出来时回复 400 并返回 null */
  const pickTemplate = (kind: LetterStatus, templateId: string | undefined, reply: FastifyReply): TemplateContent | null => {
    try {
      return mail.templates.pick(kind, templateId).content;
    } catch (error) {
      if (!(error instanceof TemplateStoreError)) throw error;
      reply.code(400).send({ error: "template_invalid", message: error.message, reason: error.code });
      return null;
    }
  };

  app.get<{ Params: { application_id: string } }>(
    "/api/console/applications/:application_id",
    { preHandler: requireScopedPermission("apply.view") },
    async (req, reply) => {
      const application = findApplication(req.params.application_id);
      if (!application) return reply.code(404).send({ error: "not_found", message: "投递不存在" });
      app.services.activity.recordActivity(req, { action: "application.view", surface: "console", target_type: "application", target_id: application.id, outcome: "ok" });
      return {
        application,
        reviews: withMail(reviewsOf(application.id)),
        received_mail: mail.summary(`application:${application.id}:received`),
        mail: { enabled: mail.enabled, recipients: mail.recipients, deliverable: mail.deliverable(application.email) },
        // 改状态时能选的信（#285）：每一类启用的模板，只有名字，内容留在 mail.template.manage 那边
        letter_templates: letterTemplates(),
      };
    },
  );

  app.patch<{ Params: { application_id: string }; Body: ReviewBody }>(
    "/api/console/applications/:application_id",
    { preHandler: [requireScopedPermission("apply.review"), requireStepUp] },
    async (req, reply) => {
      const current = findApplication(req.params.application_id);
      if (!current) return reply.code(404).send({ error: "not_found", message: "投递不存在" });
      const { status, notify, letter = {} } = req.body;
      if (status !== undefined && !(APPLICATION_STATUS_IDS as string[]).includes(status)) {
        return reply.code(400).send({ error: "invalid_status", message: "状态只能是已收到、待面试、已录取、未通过、已取消" });
      }
      // 控制台带上页面上看到的状态和审核记录的版本号（最大的 id，没有记录时是 0）：别人在这之间处理过，就不按旧画面改，
      // 也不发信（改状态的信发出去撤不回来）。只比状态会漏掉「改走又改回」，所以还比审核记录。
      const changedMeanwhile = (message?: string) => {
        const latest = findApplication(current.id) ?? current;
        return reply.code(409).send({
          error: "status_changed", message: message ?? `这份投递刚被别人处理过，现在是「${statusLabel(latest.status)}」，看过最新的记录再改`, application: latest,
        });
      };
      const { expected_status: expectedStatus, expected_review_id: expectedReviewId } = req.body;
      const seenReviewId = (lastReviewId.get(current.id) as { id: number }).id;
      if (expectedStatus !== undefined && expectedStatus !== current.status) return changedMeanwhile();
      if (expectedReviewId !== undefined && expectedReviewId !== seenReviewId) return changedMeanwhile();
      // 要改状态就必须带这两项：部署前打开、还没刷新的旧页面不带，不能让它按旧画面发信。
      if (status !== undefined && status !== current.status && (expectedStatus === undefined || expectedReviewId === undefined)) {
        return changedMeanwhile("这个页面是旧版本，刷新后再改");
      }
      const next = status ?? current.status;
      const note = req.body.note?.trim() || null;
      if (next === current.status && !note) return reply.code(400).send({ error: "no_change", message: "状态没有变化，也没有填写备注" });

      // 状态真的变成待面试、已录取、未通过，并且没有取消发信，才发信；备注只给审核人看，不进信里。
      // 信在写库之前渲染：内容不合规时直接 400，状态不改。
      const letterKind = next !== current.status && notify !== false && isLetterStatus(next) ? next : null;
      let letterMail: RenderedMail | null = null;
      if (letterKind) {
        if (letterKind === "interview") {
          const fields: { time?: string; place?: string } = {};
          if (!oneLine(letter.time ?? "")) fields.time = "请填面试时间";
          if (!oneLine(letter.place ?? "")) fields.place = "请填面试地点";
          if (fields.time || fields.place) return reply.code(400).send({ error: "letter_required", message: "要发待面试的信，请填面试时间和地点", fields });
        }
        const content = pickTemplate(letterKind, req.body.template_id, reply);
        if (!content) return reply;
        try {
          letterMail = mail.recruitmentLetter(letterKind, current, letter, content);
        } catch (error) {
          if (!(error instanceof MailTemplateError)) throw error;
          return reply.code(400).send({ error: "letter_invalid", message: renderErrorMessage(error) });
        }
      }

      const reviewer = req.session!.login;
      const review = db.transaction(() => {
        // 带着读到的状态改：读和写之间状态变了（changes 为 0）就什么也不写，回 409
        if (next !== current.status && db.prepare("UPDATE applications SET status = ? WHERE id = ? AND status = ?").run(next, current.id, current.status).changes !== 1) return null;
        const result = db.prepare("INSERT INTO application_reviews(application_id, from_status, to_status, note, reviewer, created_at) VALUES(?, ?, ?, ?, ?, ?)")
          .run(current.id, current.status, next, note, reviewer, Date.now());
        const reviewId = Number(result.lastInsertRowid);
        // 同一事务写进发信队列：改状态和这封信要么都在、要么都不在
        if (letterKind && letterMail) {
          mail.enqueue({ eventKey: `review:${reviewId}`, kind: `recruitment.${letterKind}`, applicationId: current.id, reviewId, to: current.email, mail: letterMail });
        }
        return db.prepare("SELECT id, from_status, to_status, note, reviewer, created_at FROM application_reviews WHERE id = ?").get(reviewId) as Omit<ReviewRow, "application_id">;
      })();
      if (!review) return changedMeanwhile();
      // 备注属于候选人相关信息，只进 application_reviews，不写进审计；信的内容也不进审计，只记这次有没有发信。
      app.services.activity.recordActivity(req, { action: "application.review", surface: "console", target_type: "application", target_id: current.id, outcome: "ok", meta: { from: current.status, to: next, has_note: Boolean(note), mail: Boolean(letterKind) } });
      return { application: findApplication(current.id), review: withMail([review])[0] };
    },
  );

  // 预览将要发的信（#285）：用这份投递的真实字段和页面上填的内容，按选的模板渲染，不发信、不改状态、不写审核记录。
  // 面试时间、地点还没填时用占位文字，让预览里看得出它们出现的位置；真正改状态时仍然要求必填。
  app.post<{ Params: { application_id: string }; Body: { status: string; template_id?: string; letter?: RecruitmentLetter } }>(
    "/api/console/applications/:application_id/letter-preview",
    { preHandler: requireScopedPermission("apply.review"), config: { rateLimit: { max: 240, timeWindow: "1 minute", keyGenerator: byAccount, hook: "preHandler" } } },
    async (req, reply) => {
      const application = findApplication(req.params.application_id);
      if (!application) return reply.code(404).send({ error: "not_found", message: "投递不存在" });
      const { status, template_id: templateId, letter = {} } = req.body;
      if (!isLetterStatus(status)) return reply.code(400).send({ error: "no_letter", message: "只有改成待面试、已录取、未通过才会发信，其它状态没有信可以预览" });
      const content = pickTemplate(status, templateId, reply);
      if (!content) return reply;
      try {
        const { subject, html, text } = mail.previewLetter(status, content, application, letter);
        return { subject, html, text };
      } catch (error) {
        if (!(error instanceof MailTemplateError)) throw error;
        return reply.code(400).send({ error: "letter_invalid", message: renderErrorMessage(error) });
      }
    },
  );
}
