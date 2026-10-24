import { body, choices, integer, limitParam, nullableText, object, text, type RouteContracts } from "../../lib/http-contracts.js";
import {
  competitionFailures, competitionIdParam, competitionLeaderboard, freeAgentList, myCompetitionList, myStatus,
  publicCompetition, publicCompetitionList, signupBody, teamIdParam, teamList,
} from "../../lib/competition-contract.js";
import { APPLICATION_STATUS_IDS } from "../../lib/roles.js";
const proof = object({ timestamp: { type: "integer" }, nonce: text(32, 1) }, ["timestamp", "nonce"]);
const abuse = { pow: proof, website: text(200), homepage: text(200), url_ref: text(200), turnstile_token: text(4096) };
// UUID v4：applications.id 的生成方式（node:crypto 的 randomUUID()），和 console/contracts.ts 的 UUID_PATTERN 一致。
const APPLICATION_ID_PATTERN = "^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$";
export const portalContracts: RouteContracts = {
  "GET /api/public/competitions": { querystring: object({}), response: { 200: publicCompetitionList, ...competitionFailures } },
  "GET /api/public/competitions/:id": { ...competitionIdParam, response: { 200: publicCompetition, ...competitionFailures } },
  "GET /api/public/org": { querystring: object({}) },
  // 公开的部门与称号列表（#274）：给门户「组织架构」用，6 个新部门，不含任何人
  "GET /api/public/departments": { querystring: object({}), response: { 200: object({
    departments: { type: "array", items: object({
      id: text(64, 1), name: text(64, 1), tone: { anyOf: [text(20), { type: "null" }] }, icon: { anyOf: [text(64), { type: "null" }] }, description: text(500),
      titles: { type: "array", items: object({ id: text(64, 1), name: text(64, 1), weight: { type: "integer" } }, ["id", "name", "weight"]) },
    }, ["id", "name", "tone", "icon", "description", "titles"]) },
  }, ["departments"]) } },
  // 公开的代码仓库列表（#274）：只给 visibility=public 的项目；GitLab 没配或连不上时 projects 为空、unavailable 为 true
  "GET /api/public/gitlab/projects": {
    querystring: object({}),
    response: { 200: object({
      projects: { type: "array", items: object({
        name: text(255, 1), path_with_namespace: text(255, 1), description: { anyOf: [text(2000), { type: "null" }] },
        web_url: text(500, 1), http_url_to_repo: text(500, 1), last_activity_at: { anyOf: [text(40), { type: "null" }] },
      }, ["name", "path_with_namespace", "description", "web_url", "http_url_to_repo", "last_activity_at"]) },
      unavailable: { type: "boolean" },
    }, ["projects"]) },
  },
  "GET /api/docs/:id": { params: object({ id: text(64, 1) }, ["id"]) },
  // 前端批量上报动作（#274 SPEC §3.7）：访客也能调，最多 20 条；白名单在 lib/activity.ts，不在契约里重复列。
  "POST /api/events": {
    ...body({
      events: {
        type: "array", minItems: 1, maxItems: 20,
        items: object({ action: text(64, 1), target_type: nullableText(64), target_id: nullableText(128), meta: { type: "object" } }, ["action"]),
      },
    }, ["events"]),
    response: { 200: object({ accepted: integer(0), rejected: integer(0) }, ["accepted", "rejected"]) },
  },
  // 重复的 org 参数会被解析成数组，在合同这里回 400，不进路由变成 500（#129）。合同整份替换公共 querystring，limit 引用公共规则。
  "GET /api/feedback/public": { querystring: object({ org: text(39), limit: limitParam }, [], true) },
  "POST /api/feedback": body({ org: text(39, 1), content: text(5000, 5), category: text(20), contact: text(200), ...abuse }, ["org", "content"]),

  // 我的投递状态（#277，geek apply status）：按账号已绑定的登录邮箱配 applications.email，不回姓名、班级、邮箱、特长。
  "GET /api/me/applications": { querystring: object({}), response: { 200: object({
    applications: { type: "array", items: object({
      id: { type: "string", pattern: APPLICATION_ID_PATTERN }, status: choices(...APPLICATION_STATUS_IDS), created_at: integer(0),
    }, ["id", "status", "created_at"]) },
  }, ["applications"]) } },

  // 报名与组队（#239）：全部要求登录且是极客班成员；写操作每人每分钟 30 次。
  "GET /api/me/competitions": { response: { 200: myCompetitionList, ...competitionFailures } },
  "GET /api/competitions/:id/my-status": { ...competitionIdParam, response: { 200: myStatus, ...competitionFailures } },
  "POST /api/competitions/:id/signup": { ...competitionIdParam, body: signupBody.signup, response: { 200: myStatus, ...competitionFailures } },
  "DELETE /api/competitions/:id/signup": { ...competitionIdParam, response: { 200: myStatus, ...competitionFailures } },
  "GET /api/competitions/:id/teams": { ...competitionIdParam, response: { 200: teamList, ...competitionFailures } },
  "GET /api/competitions/:id/free-agents": { ...competitionIdParam, response: { 200: freeAgentList, ...competitionFailures } },
  "POST /api/competitions/:id/teams": { ...competitionIdParam, body: signupBody.teamCreate, response: { 201: myStatus, ...competitionFailures } },
  "POST /api/teams/:id/apply": { ...teamIdParam, body: signupBody.apply, response: { 201: myStatus, ...competitionFailures } },
  "POST /api/teams/:id/invite": { ...teamIdParam, body: signupBody.invite, response: { 201: myStatus, ...competitionFailures } },
  "POST /api/teams/:id/respond": { ...teamIdParam, body: signupBody.respond, response: { 200: myStatus, ...competitionFailures } },
  "POST /api/teams/:id/leave": { ...teamIdParam, response: { 200: myStatus, ...competitionFailures } },
  "POST /api/teams/:id/transfer": { ...teamIdParam, body: signupBody.transfer, response: { 200: myStatus, ...competitionFailures } },
  "DELETE /api/teams/:id": { ...teamIdParam, response: { 200: myStatus, ...competitionFailures } },
  "POST /api/teams/:id/lock": { ...teamIdParam, response: { 200: myStatus, ...competitionFailures } },
  "DELETE /api/teams/:id/lock": { ...teamIdParam, response: { 200: myStatus, ...competitionFailures } },
  "GET /api/competitions/:id/leaderboard": { ...competitionIdParam, response: { 200: competitionLeaderboard, ...competitionFailures } },
};
