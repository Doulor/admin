import { choices, integer, object, text, type RouteContracts } from "../http-contracts.js";
import { RECRUITMENT_KINDS } from "./template-content.js";

/**
 * 招聘邮件模板接口的合同（#285，路由在 routes/console/mail-templates.ts 和 routes/console/applications.ts）。
 * 请求体里的内容字段只在这里做类型和整体大小的粗校验：逐项的长度、块的结构、变量是不是清单里的，
 * 由 template-content.ts 的 normalizeContent 核对，并带着出错的位置（path）回 400 template_invalid，前端把话标在对应的输入框上。
 */

const kind = choices(...RECRUITMENT_KINDS);
/** 模板 id：迁移种子是可读的 default-received 这类，新建的是 UUID */
export const templateId = { type: "string", pattern: "^[a-z0-9][a-z0-9-]{0,63}$" };
const applicationId = { type: "string", pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$" };
const noQuery = { querystring: object({}) };
const nullable = (schema: unknown) => ({ anyOf: [schema, { type: "null" }] });
const freeObject = { type: "object", additionalProperties: true };
// 失败体保留共同错误处理器的扩展字段，以及这组接口自己的 issues（出错的位置）、reason、bucket、retry_after
const failures = {
  "4xx": object({
    error: { type: "string" }, message: { type: "string" }, request_id: { type: "string" }, node: { type: "string" }, reason: { type: "string" },
    bucket: { type: "string" }, retry_after: integer(0), issues: { type: "array", items: object({ path: { type: "string" }, message: { type: "string" } }, ["path", "message"]) },
  }, ["error"], true),
  "5xx": object({ error: { type: "string" }, message: { type: "string" }, request_id: { type: "string" } }, ["error"], true),
};

const loose = text(20000);
const looseBlocks = { type: "array", maxItems: 100, items: {} };
const looseFooter = { type: "array", maxItems: 20, items: loose };
const looseButton = nullable(object({ label: loose, path: loose }, [], true));
const contentFields = { subject: loose, preheader: loose, kicker: loose, greeting: loose, blocks: looseBlocks, button: looseButton, footer: looseFooter };

/** 预览与试发共用的示例：没给的项用内置的示例投递和示例信 */
const sample = object({ name: text(200), class_name: text(200), strengths: text(5000) });
const letter = object({ time: text(200), place: text(300), notes: text(5000), message: text(5000) });
const draft = object({ kind, ...contentFields }, ["kind", "subject", "blocks"]);

const templateView = object({
  id: templateId, name: text(200, 1), kind, enabled: { type: "boolean" }, is_default: { type: "boolean" },
  subject: loose, preheader: loose, kicker: loose, greeting: loose, blocks: { type: "array", items: freeObject },
  button: nullable(object({ label: loose, path: loose }, ["label", "path"])), footer: { type: "array", items: loose },
  created_by: text(200), created_at: integer(0), updated_by: text(200), updated_at: integer(0),
}, ["id", "name", "kind", "enabled", "is_default", "subject", "preheader", "kicker", "greeting", "blocks", "button", "footer", "created_by", "created_at", "updated_by", "updated_at"]);

const renderedView = object({ subject: loose, html: { type: "string" }, text: { type: "string" } }, ["subject", "html", "text"]);

const templateParams = { params: object({ template_id: templateId }, ["template_id"]) };

export const mailTemplateContracts: RouteContracts = {
  "GET /api/console/mail-templates": {
    ...noQuery,
    response: {
      200: object({
        templates: { type: "array", items: templateView },
        kinds: { type: "array", items: object({ id: kind, label: text(16, 1) }, ["id", "label"]) },
        block_kinds: { type: "array", items: object({ id: text(16, 1), label: text(16, 1) }, ["id", "label"]) },
        variables: {
          type: "array",
          items: object({
            name: text(32, 1), group: text(16, 1), group_label: text(16, 1), description: text(300, 1),
            kinds: { type: "array", items: kind }, multiline: { type: "boolean" },
          }, ["name", "group", "group_label", "description", "kinds", "multiline"]),
        },
        limits: freeObject,
        mail: object({ enabled: { type: "boolean" }, recipients: choices("all", "allowlist"), reply_to: { type: "boolean" } }, ["enabled", "recipients", "reply_to"]),
        test_send: object({ per_hour_per_account: integer(1), per_hour_site: integer(1) }, ["per_hour_per_account", "per_hour_site"]),
      }, ["templates", "kinds", "block_kinds", "variables", "limits", "mail", "test_send"]),
      ...failures,
    },
  },
  "POST /api/console/mail-templates": {
    ...noQuery,
    body: object({ name: loose, kind, enabled: { type: "boolean" }, ...contentFields }, ["name", "kind", "subject", "blocks"]),
    response: { 201: templateView, ...failures },
  },
  "PATCH /api/console/mail-templates/:template_id": {
    ...noQuery, ...templateParams,
    // is_default 只能设成 true：换默认就是把另一套设为默认。expected_updated_at 是编辑页读到的更新时间，库里不同说明别人改过，回 409。
    body: { ...object({ name: loose, enabled: { type: "boolean" }, is_default: { type: "boolean", enum: [true] }, ...contentFields, expected_updated_at: integer(0) }), minProperties: 1 },
    response: { 200: templateView, ...failures },
  },
  "DELETE /api/console/mail-templates/:template_id": {
    ...noQuery, ...templateParams,
    response: { 200: object({ ok: { type: "boolean" } }, ["ok"]), ...failures },
  },
  // 预览：template_id 和 draft 给一个。不入队、不写投递和审核记录；application_id 给了就用那份投递的真实字段，否则用示例。
  "POST /api/console/mail-templates/preview": {
    ...noQuery,
    body: object({ template_id: templateId, draft, application_id: applicationId, sample, letter }),
    response: { 200: renderedView, ...failures },
  },
  // 试发：只发给 to 这一个地址、一封，数据只用示例，不动任何投递记录。
  "POST /api/console/mail-templates/test-send": {
    ...noQuery,
    body: object({ template_id: templateId, draft, to: text(320, 3), sample, letter }, ["to"]),
    response: {
      200: object({
        status: choices("sent", "failed", "skipped", "pending"), skip_reason: nullable(text(40)), error: nullable(text(300)), subject: loose, to: text(320),
      }, ["status", "skip_reason", "error", "subject", "to"]),
      ...failures,
    },
  },
  // 审核人在投递详情里预览将要发的信：用这份投递的真实字段，不发信、不改状态。
  "POST /api/console/applications/:application_id/letter-preview": {
    ...noQuery, params: object({ application_id: applicationId }, ["application_id"]),
    body: object({ status: text(32, 1), template_id: templateId, letter }, ["status"]),
    response: { 200: renderedView, ...failures },
  },
};
