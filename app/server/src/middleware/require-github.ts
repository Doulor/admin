import type { FastifyReply, FastifyRequest } from "fastify";
import type { GithubClient } from "../lib/github-connection.js";
import type { Capability } from "../lib/roles.js";
import { requireCapability } from "./require-capability.js";

declare module "fastify" {
  interface FastifyRequest {
    /** 这次请求接 GitHub 用的客户端（requireGithub 放进来）：服务器的 GitHub App，或本人的 GitHub 会话令牌。 */
    github?: GithubClient;
  }
}

/**
 * `/api/admin/:org/*` 的守卫（#262 第四期，权限只认极客班账号）：先按站内称号查能力，再核对 `:org` 是控制台管的组织
 * （CONSOLE_ORG，不分大小写；ALLOWED_ORGS 非空时启动就要求包含它），最后把接入的 GitHub 客户端放到 `req.github`。
 * 不再看本人在 GitHub 组织里的角色；GitHub 接不上时回 409 github_not_connected（lib/github-connection.ts）。需在 requireAuth 之后使用。
 */
export function requireGithub(...anyOf: Capability[]) {
  const managed = requireManagedOrg(...anyOf);
  return async (req: FastifyRequest, reply: FastifyReply) => {
    await managed(req, reply);
    if (reply.sent) return reply;
    req.github = await req.server.services.githubConnection.clientFor(req.session);
  };
}

/** 只核对能力和 `:org`、不碰 GitHub 的 `/api/admin/:org/*`（意见箱、审计日志、邀请链接的列表与开关）。 */
export function requireManagedOrg(...anyOf: Capability[]) {
  const capability = requireCapability(...anyOf);
  return async (req: FastifyRequest, reply: FastifyReply) => {
    await capability(req, reply);
    if (reply.sent) return reply;
    const { consoleOrg } = req.server.services.config;
    const org = (req.params as { org?: string }).org;
    if (!org) return reply.code(400).send({ error: "missing_org" });
    if (org.toLowerCase() !== consoleOrg.toLowerCase()) return reply.code(403).send({ error: "org_not_managed", message: `控制台只管 ${consoleOrg}`, org });
  };
}
