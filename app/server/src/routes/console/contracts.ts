import { choices, integer, object, text, type RouteContracts } from "../../lib/http-contracts.js";
import {
  APPLICATION_STATUS_IDS, ASSIGNABLE_ROLES, CAPABILITY_IDS, DEPARTMENT_ICONS, DEPARTMENT_ID_PATTERN, DEPARTMENT_TAG_PATTERN, TITLE_IDS, TITLE_TAG_PATTERN, TONE_IDS,
} from "../../lib/roles.js";
import { FEEDBACK_STATUSES } from "../../lib/feedback-store.js";
import { INVITE_CODE_PATTERN } from "../../lib/invite-codes.js";
import {
  competitionFields, competitionFailures, competitionDeleted, consoleCompetitionList, consoleCompetitionResult,
  competitionRoster, signupSettingsResult, signupBody, consoleCompetitionIdParam, scoreEventList, scoreEventResult, scoreEventParam,
} from "../../lib/competition-contract.js";

/** 与 config.GITHUB_LOGIN_REGEX 一致；这里写成 JSON Schema 可用的字符串。 */
const GITHUB_LOGIN_PATTERN = "^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$";
const UUID_PATTERN = "^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$";

const login = { type: "string", pattern: GITHUB_LOGIN_PATTERN };
/** 极客班账号 id：26 位 Crockford Base32（lib/identity-store.ts 的 newAccountId）。 */
const accountId = { type: "string", pattern: "^[0-9A-HJKMNP-TV-Z]{26}$" };
const nullableInteger = { anyOf: [integer(), { type: "null" }] };
const nullableString = (max: number) => ({ anyOf: [text(max), { type: "null" }] });
const assignmentView = object({
  id: integer(), github_login: text(64, 1), github_user_id: nullableInteger, account_id: { anyOf: [accountId, { type: "null" }] },
  role: choices(...ASSIGNABLE_ROLES), department_id: text(64), note: nullableString(200), granted_by: text(100), created_at: integer(0),
}, ["id", "github_login", "github_user_id", "account_id", "role", "department_id", "note", "granted_by", "created_at"]);
// 失败体保留共同错误处理器的扩展字段（capability、any_of）
const consoleFailures = {
  "4xx": object({ error: { type: "string" }, message: { type: "string" }, request_id: { type: "string" }, capability: { type: "string" }, any_of: { type: "array", items: { type: "string" } } }, ["error"], true),
  "5xx": object({ error: { type: "string" }, message: { type: "string" }, request_id: { type: "string" } }, ["error"], true),
};
const departmentId = { type: "string", pattern: DEPARTMENT_ID_PATTERN };
/** 权限包：只接受清单内的能力 id；仅舰长能力在路由里单独拒绝（captain_only_capability），重复项在存储时去重。 */
const bundle = { type: "array", items: choices(...CAPABILITY_IDS), maxItems: CAPABILITY_IDS.length * 2 };
/** 查询串里的有界正整数（coerceTypes 关闭，查询值都是字符串）。 */
const LIMIT_PATTERNS = { 200: "^(?:[1-9][0-9]?|1[0-9]{2}|200)$", 500: "^(?:[1-9][0-9]?|[1-4][0-9]{2}|500)$" } as const;
const limit = (max: keyof typeof LIMIT_PATTERNS) => ({ type: "string", pattern: LIMIT_PATTERNS[max] });
const offset = { type: "string", pattern: "^[0-9]{1,8}$" };
const noQuery = { querystring: object({}) };
const nullableCount = { anyOf: [integer(0), { type: "null" }] };
// GitLab 同步（#270）：一个要做的动作，和成员页上一个账号的同步状态
const gitlabAction = {
  oneOf: [
    object({ kind: choices("create"), username: text(64, 1), access_level: integer(10, 50) }, ["kind", "username", "access_level"]),
    object({ kind: choices("block", "unblock", "find_and_block", "set_avatar", "set_emails") }, ["kind"]),
    object({ kind: choices("set_access"), access_level: integer(10, 50) }, ["kind", "access_level"]),
  ],
};
const gitlabAccountView = object({
  account_id: accountId, login: text(100, 1), username: nullableString(64), gitlab_user_id: nullableInteger,
  state: { anyOf: [choices("pending", "active", "blocked"), { type: "null" }] }, access_level: nullableInteger,
  last_error: nullableString(64), last_error_at: nullableCount, synced_at: nullableCount, pending: { type: "array", items: gitlabAction },
}, ["account_id", "login", "username", "gitlab_user_id", "state", "access_level", "last_error", "last_error_at", "synced_at", "pending"]);
const gitlabSettingsResult = object({
  sync_mode: choices("off", "dry-run", "on"), group_path: text(255, 1), interval_minutes: integer(5, 1440), token_configured: { type: "boolean" },
}, ["sync_mode", "group_path", "interval_minutes", "token_configured"]);
const inviteView = object({
  id: integer(), code: text(40, 1), note: text(100), max_uses: nullableCount, used_count: integer(0), expires_at: nullableCount,
  disabled: { type: "boolean" }, created_by: text(100), created_at: integer(0), updated_at: integer(0), usable: { type: "boolean" },
}, ["id", "code", "note", "max_uses", "used_count", "expires_at", "disabled", "created_by", "created_at", "updated_at", "usable"]);
// 失败体保留共同错误处理器的扩展字段（如 capability）
const inviteFailures = {
  "4xx": object({ error: { type: "string" }, message: { type: "string" }, request_id: { type: "string" }, capability: { type: "string" } }, ["error"], true),
  "5xx": object({ error: { type: "string" }, message: { type: "string" }, request_id: { type: "string" } }, ["error"], true),
};
const departmentFields = {
  name: text(12, 2), tag: { type: "string", pattern: DEPARTMENT_TAG_PATTERN },
  icon: choices(...DEPARTMENT_ICONS), tone: choices(...TONE_IDS), description: text(200),
  head_capabilities: bundle, member_capabilities: bundle, sort_order: integer(0, 10000),
};
// 新能力也扩展了这些权限包接口的入参枚举，响应合同必须保留原有展示、计数与时间字段。
const departmentViewFields = {
  id: departmentId, ...departmentFields, archived: { type: "boolean" },
  created_at: integer(0), updated_at: integer(0),
  heads: { type: "array", items: login }, crew_count: integer(0),
};
const departmentResult = object({
  department: object(departmentViewFields, Object.keys(departmentViewFields)),
}, ["department"]);
const titleViewFields = {
  id: choices(...TITLE_IDS), label: text(8, 1), tag: text(16, 1), icon: { type: "string" },
  tone: choices(...TONE_IDS), description: text(200), capabilities: bundle,
};
const titleResult = object({ title: object(titleViewFields, Object.keys(titleViewFields)) }, ["title"]);
const applicationParams = { params: object({ application_id: { type: "string", pattern: UUID_PATTERN } }, ["application_id"]) };
// 比赛 id 是 UUID，但种子比赛用的是可读 slug（oss-challenge-2026-1），路径参数不能只收 UUID。
const competitionParams = consoleCompetitionIdParam;

/** `/api/console/*` 的输入协议源。所有 body 与 query 都拒绝未知字段。 */
export const consoleContracts: RouteContracts = {
  "GET /api/console/me": noQuery,
  "GET /api/console/catalogue": noQuery,
  "GET /api/console/summary": noQuery,
  "GET /api/console/departments": noQuery,
  "POST /api/console/departments": {
    ...noQuery,
    body: object({ id: departmentId, ...departmentFields }, ["id", "name", "tag", "icon", "tone", "head_capabilities"]),
    response: { 201: departmentResult },
  },
  "PATCH /api/console/titles/:title_id": {
    ...noQuery,
    params: object({ title_id: choices(...TITLE_IDS) }, ["title_id"]),
    body: {
      ...object({
        label: { ...text(8, 1), pattern: "\\S" }, tag: { type: "string", pattern: TITLE_TAG_PATTERN }, icon: choices(...DEPARTMENT_ICONS),
        tone: choices(...TONE_IDS), description: text(200), capabilities: bundle,
      }),
      minProperties: 1,
    },
    response: { 200: titleResult },
  },
  "PATCH /api/console/departments/:department_id": {
    ...noQuery,
    params: object({ department_id: departmentId }, ["department_id"]),
    body: { ...object({ ...departmentFields, archived: { type: "boolean" } }), minProperties: 1 },
    response: { 200: departmentResult },
  },
  "DELETE /api/console/departments/:department_id": {
    ...noQuery,
    params: object({ department_id: departmentId }, ["department_id"]),
  },
  "GET /api/console/assignments": {
    querystring: object({ department_id: departmentId, role: choices(...ASSIGNABLE_ROLES) }),
  },
  // 指派给极客班账号（account_id）或 GitHub 用户名（github_login），二选一（#262 第四期）
  "POST /api/console/assignments": {
    ...noQuery,
    body: {
      ...object({ github_login: login, account_id: accountId, role: choices(...ASSIGNABLE_ROLES), department_id: departmentId, note: text(200) }, ["role"]),
      oneOf: [{ required: ["github_login"] }, { required: ["account_id"] }],
    },
    response: { 201: object({ assignment: assignmentView }, ["assignment"]), ...consoleFailures },
  },
  // 站内角色：管理员（提督）、成员（舰员）、不是成员（移出极客班）；只有提督能改
  "PATCH /api/console/people/:account_id/site-role": {
    ...noQuery,
    params: object({ account_id: accountId }, ["account_id"]),
    body: object({ site_role: choices("admin", "member", "none") }, ["site_role"]),
    response: { 200: object({ account_id: accountId, site_role: choices("admin", "member", "none"), changed: { type: "boolean" } }, ["account_id", "site_role", "changed"]), ...consoleFailures },
  },
  // GitLab 账号同步（#270）：mode 是 off、dry-run 或 on；pending 是现在还要做的事，dry-run 时只列出、不做
  "GET /api/console/gitlab/accounts": {
    ...noQuery,
    response: { 200: object({
      mode: choices("off", "dry-run", "on"), gitlab_url: nullableString(255), group: text(255, 1), client_registered: { type: "boolean" },
      accounts: { type: "array", items: gitlabAccountView },
    }, ["mode", "gitlab_url", "group", "client_registered", "accounts"]), ...consoleFailures },
  },
  "POST /api/console/gitlab/accounts/:account_id/resync": {
    ...noQuery,
    params: object({ account_id: accountId }, ["account_id"]),
    response: { 200: object({
      mode: choices("dry-run", "on"), account_id: accountId, login: text(100, 1), actions: { type: "array", items: gitlabAction },
      applied: { type: "boolean" }, error: nullableString(64),
    }, ["mode", "account_id", "login", "actions", "applied", "error"]), ...consoleFailures },
  },
  // 控制台概览（#274）：同步开关、能不能连上、GitLab 版本号、上一轮对账小结、过去 24 小时还在失败状态的账号数
  "GET /api/console/gitlab/status": {
    ...noQuery,
    response: { 200: object({
      mode: choices("off", "dry-run", "on"), url: nullableString(255), group: text(255, 1), token_configured: { type: "boolean" },
      version: nullableString(32), healthy: { type: "boolean" },
      last_run: { anyOf: [object({ at: integer(0), changed: integer(0), failed: integer(0) }, ["at", "changed", "failed"]), { type: "null" }] },
      errors_24h: integer(0),
    }, ["mode", "url", "group", "token_configured", "version", "healthy", "last_run", "errors_24h"]), ...consoleFailures },
  },
  "GET /api/console/gitlab/projects": {
    ...noQuery,
    response: { 200: object({
      groups: { type: "array", items: object({ id: integer(1), full_path: text(255, 1), name: text(255, 1), visibility: text(20, 1) }, ["id", "full_path", "name", "visibility"]) },
      projects: { type: "array", items: object({
        id: integer(1), path_with_namespace: text(255, 1), name: text(255, 1), description: nullableString(2000), visibility: text(20, 1),
        web_url: text(500, 1), http_url_to_repo: text(500, 1), ssh_url_to_repo: text(500, 1), last_activity_at: nullableString(40), star_count: integer(0),
      }, ["id", "path_with_namespace", "name", "description", "visibility", "web_url", "http_url_to_repo", "ssh_url_to_repo", "last_activity_at", "star_count"]) },
    }, ["groups", "projects"]), ...consoleFailures },
  },
  "GET /api/console/gitlab/settings": {
    ...noQuery,
    response: { 200: gitlabSettingsResult, ...consoleFailures },
  },
  "PATCH /api/console/gitlab/settings": {
    ...noQuery,
    body: object({ sync_mode: choices("off", "dry-run", "on"), group_path: text(255, 1), interval_minutes: integer(5, 1440) }),
    response: { 200: gitlabSettingsResult, ...consoleFailures },
  },
  "DELETE /api/console/assignments/:id": noQuery,
  "GET /api/console/people": noQuery,
  "GET /api/console/applications": {
    querystring: object({ status: choices(...APPLICATION_STATUS_IDS), q: text(100), limit: limit(200), offset }),
  },
  "GET /api/console/applications/export.csv": { querystring: object({ status: choices(...APPLICATION_STATUS_IDS) }) },
  "GET /api/console/applications/:application_id": { ...noQuery, ...applicationParams },
  "PATCH /api/console/applications/:application_id": {
    ...noQuery, ...applicationParams,
    // 空 body 交给路由返回 400 no_change，而不是笼统的 validation_error；状态值在路由里核对，回 400 invalid_status。
    // letter 是改状态时发的信的内容（#148）：待面试的时间、地点、说明，已录取的「接下来」，未通过的原因。
    // expected_status、expected_review_id 是控制台页面上看到的状态和审核记录的版本号（最大的审核记录 id，没有记录时是 0），
    // 和库里不同时回 409 status_changed，不改也不发信；要改状态时两项都得带。
    body: object({
      status: text(32), expected_status: choices(...APPLICATION_STATUS_IDS), expected_review_id: integer(0), note: text(2000), notify: { type: "boolean" },
      letter: object({ time: text(60), place: text(120), notes: text(1000), message: text(1000) }),
    }),
  },
  "GET /api/console/feedback": { querystring: object({ status: choices(...FEEDBACK_STATUSES), limit: limit(500) }) },
  "PATCH /api/console/feedback/:id": {
    ...noQuery,
    body: { ...object({ status: choices(...FEEDBACK_STATUSES), reply: text(5000) }), minProperties: 1 },
  },
  "GET /api/console/competitions": { ...noQuery, response: { 200: consoleCompetitionList, ...competitionFailures } },
  "POST /api/console/competitions": {
    ...noQuery,
    body: object({ ...competitionFields }, ["name", "kind", "start_at", "end_at"]),
    response: { 201: consoleCompetitionResult, ...competitionFailures },
  },
  "PATCH /api/console/competitions/:competition_id": {
    ...noQuery, ...competitionParams,
    body: { ...object({ ...competitionFields, offline: { type: "boolean" } }), minProperties: 1 },
    response: { 200: consoleCompetitionResult, ...competitionFailures },
  },
  "DELETE /api/console/competitions/:competition_id": { ...noQuery, ...competitionParams, response: { 200: competitionDeleted, ...competitionFailures } },
  "PUT /api/console/competitions/:competition_id/signup-settings": {
    ...noQuery, ...competitionParams,
    body: signupBody.settings,
    response: { 200: signupSettingsResult, ...competitionFailures },
  },
  "GET /api/console/competitions/:competition_id/roster": { ...noQuery, ...competitionParams, response: { 200: competitionRoster, ...competitionFailures } },
  // 200 是 text/csv 字符串（UTF-8 BOM、CRLF 换行），处理函数先设 Content-Type，Fastify 不会再按 JSON 序列化它；失败仍是 JSON。
  "GET /api/console/competitions/:competition_id/roster.csv": {
    ...noQuery, ...competitionParams,
    response: { 200: { type: "string", description: "text/csv; charset=utf-8" }, ...competitionFailures },
  },
  "GET /api/console/competitions/:competition_id/score-events": { ...noQuery, ...competitionParams, response: { 200: scoreEventList, ...competitionFailures } },
  "POST /api/console/competitions/:competition_id/score-events": {
    ...noQuery, ...competitionParams,
    body: signupBody.scoreEvent,
    response: { 201: scoreEventResult, ...competitionFailures },
  },
  "POST /api/console/competitions/:competition_id/score-events/:event_id/revoke": {
    ...noQuery, ...scoreEventParam,
    body: signupBody.revoke,
    response: { 200: scoreEventResult, ...competitionFailures },
  },
  "DELETE /api/console/feedback/:id": noQuery,
  "GET /api/console/audit": { querystring: object({ limit: limit(200), offset, action: text(64) }) },
  // 注册邀请码（#262）：次数上限、过期时间可以为空（不限）；邀请码本身建好后不能改
  "GET /api/console/invites": { ...noQuery, response: { 200: object({ invites: { type: "array", items: inviteView } }, ["invites"]), ...inviteFailures } },
  "POST /api/console/invites": {
    ...noQuery,
    body: object({
      code: { type: "string", pattern: INVITE_CODE_PATTERN }, note: text(100),
      max_uses: { anyOf: [integer(1, 100000), { type: "null" }] }, expires_at: { anyOf: [integer(0), { type: "null" }] },
    }, ["code"]),
    response: { 201: inviteView, ...inviteFailures },
  },
  "PATCH /api/console/invites/:id": {
    ...noQuery,
    body: object({
      note: text(100), max_uses: { anyOf: [integer(1, 100000), { type: "null" }] },
      expires_at: { anyOf: [integer(0), { type: "null" }] }, disabled: { type: "boolean" },
    }),
    response: { 200: inviteView, ...inviteFailures },
  },
};
