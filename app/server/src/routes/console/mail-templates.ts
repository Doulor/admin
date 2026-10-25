import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requireAuth } from "../../middleware/require-auth.js";
import { requirePermission } from "../../middleware/require-permission.js";
import { requireStepUp } from "../../middleware/require-step-up.js";
import { departmentScopedAccessFor } from "../../lib/console-scope.js";
import { maskEmail } from "../../lib/email-login.js";
import { MailTemplateError, oneLine, safeReplyTo, type RenderedMail } from "../../lib/mail/envelope.js";
import { TEST_LETTER_LIMITS, type ApplicationForMail, type RecruitmentLetter } from "../../lib/mail/mailer.js";
import { TemplateStoreError, type MailTemplate } from "../../lib/mail/template-store.js";
import {
  BLOCK_KIND_LABELS, RECRUITMENT_KINDS, SAMPLE_APPLICATION, SAMPLE_LETTER, TEMPLATE_BLOCK_KINDS, TEMPLATE_LIMITS, TEMPLATE_VARIABLES, VARIABLE_GROUP_LABELS,
  kindLabel, normalizeContent, renderErrorMessage,
  type RecruitmentKind, type TemplateContent, type TemplateIssue,
} from "../../lib/mail/template-content.js";

/**
 * 招聘邮件模板（#285）：多套模板的增删改查、编辑时的预览、向测试邮箱试发样信。节点 `mail.template.manage`，
 * 种子里只有站长的根通配 `*` 默认拿到（试发会真的往外发信，所以不往下发）。
 *
 * - 预览不入队、不写投递和审核记录：用示例数据，或者（还要有 apply.view）一份投递的真实字段；
 * - 试发只发给请求里填的这一个地址、一封，数据只用示例，从不带真实投递人的内容，不改任何投递记录；
 *   要求刚登录过，每个账号每小时 TEST_SEND_PER_ACCOUNT_HOUR 次，全站每小时的上限见 mailer.ts 的 TEST_LETTER_LIMITS；
 *   操作记录里只留脱敏的邮箱和模板 id，不留邮箱明文和信的内容。
 * - 模板的内容保存前都过 normalizeContent，再用示例数据真渲一遍：变量不在清单里、按钮指到官网之外、
 *   没配回信地址却请人回复这类问题当场回 400 template_invalid，不留到真正发信那一刻才发现。
 */

/** 每个账号每小时最多试发这么多封 */
export const TEST_SEND_PER_ACCOUNT_HOUR = 10;
const HOUR_MS = 3600_000;

type ContentFields = { subject?: string; preheader?: string; kicker?: string; greeting?: string; blocks?: unknown[]; button?: { label?: string; path?: string } | null; footer?: string[] };
type SampleBody = { name?: string; class_name?: string; strengths?: string };
type CreateBody = ContentFields & { name: string; kind: RecruitmentKind; enabled?: boolean };
type PatchBody = ContentFields & { name?: string; enabled?: boolean; is_default?: true; expected_updated_at?: number };
type Source = { template_id?: string; draft?: ContentFields & { kind: RecruitmentKind } };
type PreviewBody = Source & { application_id?: string; sample?: SampleBody; letter?: RecruitmentLetter };
type TestSendBody = Source & { to: string; sample?: SampleBody; letter?: RecruitmentLetter };

const CONTENT_KEYS = ["subject", "preheader", "kicker", "greeting", "blocks", "button", "footer"] as const;

const byAccount = (req: FastifyRequest) => req.session!.account_id;

/** 接口里一套模板的样子：库里的内容平铺在最外层，和编辑页的表单、预览请求里的 draft 是同一个形状 */
const view = (template: MailTemplate) => ({
  id: template.id, name: template.name, kind: template.kind, enabled: template.enabled, is_default: template.is_default,
  ...template.content,
  created_by: template.created_by, created_at: template.created_at, updated_by: template.updated_by, updated_at: template.updated_at,
});

const invalid = (reply: FastifyReply, issues: TemplateIssue[]) => reply.code(400).send({ error: "template_invalid", message: issues[0].message, issues });

export default async function consoleMailTemplateRoutes(app: FastifyInstance) {
  const { mail, limits, activity } = app.services;
  const { db } = app.services.storage;
  app.addHook("preHandler", requireAuth);
  const manage = requirePermission("mail.template.manage");

  const sampleApplication = (sample: SampleBody = {}): ApplicationForMail => ({
    id: SAMPLE_APPLICATION.id,
    name: sample.name?.trim() || SAMPLE_APPLICATION.name,
    class_name: sample.class_name?.trim() || SAMPLE_APPLICATION.class_name,
    email: SAMPLE_APPLICATION.email,
    strengths: sample.strengths?.trim() || SAMPLE_APPLICATION.strengths,
    created_at: SAMPLE_APPLICATION.created_at,
  });
  /** 示例信的内容；请求里给了的项（包括给成空字符串）用请求的 */
  const sampleLetter = (letter: RecruitmentLetter = {}): RecruitmentLetter => ({
    time: letter.time ?? SAMPLE_LETTER.time, place: letter.place ?? SAMPLE_LETTER.place,
    notes: letter.notes ?? SAMPLE_LETTER.notes, message: letter.message ?? SAMPLE_LETTER.message,
  });

  function readName(value: unknown): { name: string; issue?: TemplateIssue } {
    const name = typeof value === "string" ? oneLine(value) : "";
    if (!name) return { name, issue: { path: "name", message: "名称不能为空" } };
    if ([...name].length > TEMPLATE_LIMITS.name) return { name, issue: { path: "name", message: `名称最多 ${TEMPLATE_LIMITS.name} 个字` } };
    return { name };
  }

  /** 用示例数据把一套内容真渲一遍；再用「说明、原因都没填」的数据渲一遍，主题和抬头不能只靠可能为空的变量。 */
  function renderIssue(kind: RecruitmentKind, content: TemplateContent): TemplateIssue | null {
    const application = sampleApplication();
    try {
      mail.previewLetter(kind, content, application, sampleLetter());
    } catch (error) {
      if (!(error instanceof MailTemplateError)) throw error;
      return { path: "", message: renderErrorMessage(error) };
    }
    try {
      mail.previewLetter(kind, content, application, { ...sampleLetter(), notes: "", message: "" });
    } catch (error) {
      if (!(error instanceof MailTemplateError)) throw error;
      return { path: "", message: `改状态时没填「说明」的话，这套模板会渲染不出来（${renderErrorMessage(error)}）：主题、抬头、按钮文字里要有固定的文字` };
    }
    return null;
  }

  function storeFailure(reply: FastifyReply, error: TemplateStoreError) {
    const status = error.code === "not_found" ? 404 : error.code === "kind_mismatch" ? 400 : 409;
    const code = { not_found: "not_found", name_taken: "template_name_taken", default_locked: "default_template", changed: "template_changed", disabled: "template_disabled", kind_mismatch: "template_invalid" }[error.code];
    return reply.code(status).send({ error: code, message: error.message, reason: error.code });
  }

  /** 预览和试发要渲哪一套：已存的 template_id，或者还没保存的 draft，二选一 */
  function resolveSource(body: Source, reply: FastifyReply): { kind: RecruitmentKind; content: TemplateContent; templateId: string | null } | null {
    if ((body.template_id === undefined) === (body.draft === undefined)) {
      void reply.code(400).send({ error: "template_required", message: "要么给 template_id（已保存的模板），要么给 draft（还没保存的草稿），不能两个都给或都不给" });
      return null;
    }
    if (body.template_id !== undefined) {
      const found = mail.templates.get(body.template_id);
      if (!found) {
        void reply.code(404).send({ error: "not_found", message: "模板不存在" });
        return null;
      }
      return { kind: found.kind, content: found.content, templateId: found.id };
    }
    const { kind, ...fields } = body.draft!;
    const { content, issues } = normalizeContent(kind, fields);
    if (issues.length) {
      void invalid(reply, issues);
      return null;
    }
    return { kind, content, templateId: null };
  }

  function renderFailure(reply: FastifyReply, error: unknown) {
    if (!(error instanceof MailTemplateError)) throw error;
    return reply.code(400).send({ error: "preview_failed", message: renderErrorMessage(error) });
  }

  app.get("/api/console/mail-templates", { preHandler: manage }, async () => ({
    templates: mail.templates.list().map(view),
    kinds: RECRUITMENT_KINDS.map(id => ({ id, label: kindLabel(id) })),
    block_kinds: TEMPLATE_BLOCK_KINDS.map(id => ({ id, label: BLOCK_KIND_LABELS[id] })),
    variables: TEMPLATE_VARIABLES.map(variable => ({
      name: variable.name, group: variable.group, group_label: VARIABLE_GROUP_LABELS[variable.group], description: variable.description,
      kinds: [...variable.kinds], multiline: variable.multiline,
    })),
    limits: TEMPLATE_LIMITS,
    mail: { enabled: mail.enabled, recipients: mail.recipients, reply_to: mail.replyTo !== null },
    test_send: { per_hour_per_account: TEST_SEND_PER_ACCOUNT_HOUR, per_hour_site: TEST_LETTER_LIMITS.perHour ?? 0 },
  }));

  app.post<{ Body: CreateBody }>("/api/console/mail-templates", { preHandler: [manage, requireStepUp] }, async (req, reply) => {
    const { kind } = req.body;
    const named = readName(req.body.name);
    const { content, issues } = normalizeContent(kind, req.body);
    const found = [...(named.issue ? [named.issue] : []), ...issues];
    if (found.length) return invalid(reply, found);
    const failure = renderIssue(kind, content);
    if (failure) return invalid(reply, [failure]);
    try {
      const created = mail.templates.create({ name: named.name, kind, enabled: req.body.enabled ?? true, content }, req.session!.login, app.services.clock());
      activity.recordActivity(req, { action: "mail.template.create", surface: "console", target_type: "mail_template", target_id: created.id, outcome: "ok", meta: { kind, name: created.name, enabled: created.enabled } });
      return reply.code(201).send(view(created));
    } catch (error) {
      if (error instanceof TemplateStoreError) return storeFailure(reply, error);
      throw error;
    }
  });

  app.patch<{ Params: { template_id: string }; Body: PatchBody }>("/api/console/mail-templates/:template_id", { preHandler: [manage, requireStepUp] }, async (req, reply) => {
    const current = mail.templates.get(req.params.template_id);
    if (!current) return reply.code(404).send({ error: "not_found", message: "模板不存在" });
    const body = req.body;
    const found: TemplateIssue[] = [];
    let name: string | undefined;
    if (body.name !== undefined) {
      const named = readName(body.name);
      if (named.issue) found.push(named.issue);
      else name = named.name;
    }
    let content: TemplateContent | undefined;
    if (CONTENT_KEYS.some(key => body[key] !== undefined)) {
      // 没给的内容项沿用库里现在的，整套再核对一遍
      const merged = { ...current.content, ...Object.fromEntries(CONTENT_KEYS.filter(key => body[key] !== undefined).map(key => [key, body[key]])) };
      const result = normalizeContent(current.kind, merged);
      found.push(...result.issues);
      content = result.content;
    }
    if (found.length) return invalid(reply, found);
    if (content) {
      const failure = renderIssue(current.kind, content);
      if (failure) return invalid(reply, [failure]);
    }
    try {
      const updated = mail.templates.update(current.id, { name, enabled: body.enabled, content, is_default: body.is_default }, req.session!.login, app.services.clock(), body.expected_updated_at);
      // 只记改了哪几项，不记内容
      activity.recordActivity(req, {
        action: "mail.template.update", surface: "console", target_type: "mail_template", target_id: updated.id, outcome: "ok",
        meta: { kind: updated.kind, fields: Object.keys(body).filter(key => key !== "expected_updated_at") },
      });
      return view(updated);
    } catch (error) {
      if (error instanceof TemplateStoreError) return storeFailure(reply, error);
      throw error;
    }
  });

  app.delete<{ Params: { template_id: string } }>("/api/console/mail-templates/:template_id", { preHandler: [manage, requireStepUp] }, async (req, reply) => {
    try {
      const removed = mail.templates.delete(req.params.template_id);
      activity.recordActivity(req, { action: "mail.template.delete", surface: "console", target_type: "mail_template", target_id: removed.id, outcome: "ok", meta: { kind: removed.kind, name: removed.name } });
      return { ok: true };
    } catch (error) {
      if (error instanceof TemplateStoreError) return storeFailure(reply, error);
      throw error;
    }
  });

  // 预览：编辑时每停一下就会来一次，所以不记操作记录（用真实投递的字段时记一条，不含内容）；不入队、不写任何投递相关的表。
  app.post<{ Body: PreviewBody }>(
    "/api/console/mail-templates/preview",
    { preHandler: manage, config: { rateLimit: { max: 240, timeWindow: "1 minute", keyGenerator: byAccount, hook: "preHandler" } } },
    async (req, reply) => {
      const source = resolveSource(req.body, reply);
      if (!source) return reply;
      let application = sampleApplication(req.body.sample);
      let letter = sampleLetter(req.body.letter);
      if (req.body.application_id !== undefined) {
        // 用真实投递的字段等于读了投递人的资料，要另外有 apply.view
        if (departmentScopedAccessFor(db, req.session!.account_id, "apply.view").kind === "none") {
          return reply.code(403).send({ error: "forbidden", node: "apply.view", message: "需要「apply.view」权限" });
        }
        const row = db.prepare("SELECT id, name, class_name, email, strengths, created_at FROM applications WHERE id = ?").get(req.body.application_id) as ApplicationForMail | undefined;
        if (!row) return reply.code(404).send({ error: "not_found", message: "投递不存在" });
        application = row;
        // 真实投递的预览里，信的内容只看请求里填的，没填的项就是没填
        letter = req.body.letter ?? {};
        activity.recordActivity(req, { action: "mail.template.preview", surface: "console", target_type: "application", target_id: row.id, outcome: "ok", meta: { kind: source.kind, template_id: source.templateId } });
      }
      let rendered: RenderedMail;
      try {
        rendered = mail.previewLetter(source.kind, source.content, application, letter);
      } catch (error) {
        return renderFailure(reply, error);
      }
      return { subject: rendered.subject, html: rendered.html, text: rendered.text };
    },
  );

  app.post<{ Body: TestSendBody }>("/api/console/mail-templates/test-send", { preHandler: [manage, requireStepUp] }, async (req, reply) => {
    let to: string;
    try {
      to = safeReplyTo(req.body.to);
    } catch {
      return reply.code(400).send({ error: "invalid_address", message: "测试邮箱要是一个普通的邮箱地址，例如 name@example.com" });
    }
    const source = resolveSource(req.body, reply);
    if (!source) return reply;
    let rendered: RenderedMail;
    try {
      // 样信的主题前加「【测试】」，收到的人一眼分得出这不是发给投递人的正式信
      const sample = mail.previewLetter(source.kind, source.content, sampleApplication(req.body.sample), sampleLetter(req.body.letter));
      rendered = { ...sample, subject: `【测试】${sample.subject}` };
    } catch (error) {
      return renderFailure(reply, error);
    }
    const record = (outcome: "ok" | "error" | "limited", status: string, skipReason: string | null) => activity.recordActivity(req, {
      action: "mail.template.test_send", surface: "console", target_type: "mail_template", target_id: source.templateId ?? "draft", outcome,
      meta: { kind: source.kind, to: maskEmail(to), status, skip_reason: skipReason },
    });
    const done = (status: "sent" | "failed" | "skipped" | "pending", skipReason: string | null, error: string | null) => {
      record(status === "sent" || status === "pending" ? "ok" : "error", status, skipReason);
      return { status, skip_reason: skipReason, error, subject: rendered.subject, to: maskEmail(to) };
    };
    // 没配置发信商、或者收件地址不在白名单里：照实回答，不入队，也不占这个账号的次数
    if (!mail.deliverable(to)) return done("skipped", mail.enabled ? "not_allowlisted" : "mail_disabled", null);
    const quota = limits.hit({ bucket: "mail.test.hourly", subject: req.session!.account_id, window: { ms: HOUR_MS }, max: TEST_SEND_PER_ACCOUNT_HOUR });
    if (!quota.ok) {
      record("limited", "limited", null);
      return reply.code(429).header("Retry-After", String(quota.retry_after)).send({
        error: "rate_limited", bucket: "mail.test.hourly", message: `这个账号一小时内最多试发 ${TEST_SEND_PER_ACCOUNT_HOUR} 封，过一会儿再试`, retry_after: quota.retry_after,
      });
    }
    const eventKey = `test:${randomUUID()}`;
    const queued = mail.enqueue({ eventKey, kind: "recruitment.test", to, mail: rendered }, TEST_LETTER_LIMITS);
    if (queued.status === "pending") await mail.drain();
    const summary = mail.summary(eventKey);
    const status = summary?.status === "sending" ? "pending" : summary?.status ?? "failed";
    if (status === "skipped" && summary?.skip_reason === "rate_limited") {
      record("limited", "skipped", "rate_limited");
      return reply.code(429).header("Retry-After", "3600").send({
        error: "rate_limited", bucket: "mail.test.site", message: `全站一小时内最多试发 ${TEST_LETTER_LIMITS.perHour} 封，过一会儿再试`, retry_after: 3600,
      });
    }
    return done(status, summary?.skip_reason ?? null, status === "failed" ? mail.lastError(eventKey) ?? "unknown" : null);
  });
}
