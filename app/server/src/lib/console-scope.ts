import type Database from "better-sqlite3";
import type { FastifyReply, FastifyRequest } from "fastify";
import { loadSession } from "./session.js";
import { entriesForAccount, explain, nodeMatches, type ResolvedEntry } from "./permissions.js";

/**
 * 部门范围的权限判定（CONTRACT-274 §5：「部长的 users.view、activity.read 带 scope {department:[本部门]}」）。
 *
 * `requirePermission` 按「不给 scope 就查全局」判定，命中的是全站无限定条目；但部长拿到的条目本身带了
 * `scope:{department:[...]}}`，用空 scope 去查永远查不到（lib/permissions.ts 的 scopeMatches：条目有 scope
 * 限定、请求没给对应键，视为不满足）。所以这类「列表要不要按部门过滤」的接口不能只用 requirePermission 当门禁，
 * 要先分清楚：有没有全站的 allow（不过滤）、有没有任意一条按部门限定的 allow（过滤到那些部门），
 * 否则两种都没有才是真的没权限。只处理 department 这一个 scope 维度，不是通用的 scope 求交实现。
 */
export type DepartmentScopedAccess =
  | { kind: "full" }
  | { kind: "scoped"; departments: string[] }
  | { kind: "none" };

function scopeDepartments(entry: ResolvedEntry): string[] {
  const value = entry.scope?.department;
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value.map(String) : [String(value)];
}

export function departmentScopedAccess(entries: ResolvedEntry[], node: string): DepartmentScopedAccess {
  const global = explain(entries, node, {});
  if (global.decision === "allow") return { kind: "full" };
  if (global.decision === "deny") return { kind: "none" };
  const scoped = entries.filter(entry => entry.value && nodeMatches(entry.node, node) && scopeDepartments(entry).length > 0);
  if (scoped.length === 0) return { kind: "none" };
  return { kind: "scoped", departments: [...new Set(scoped.flatMap(scopeDepartments))] };
}

export function departmentScopedAccessFor(db: Database.Database, accountId: string, node: string, now = Date.now()): DepartmentScopedAccess {
  return departmentScopedAccess(entriesForAccount(db, accountId, now), node);
}

declare module "fastify" {
  interface FastifyRequest {
    /** requireScopedPermission 算出来的部门范围：null 是全站不过滤，数组是只能看这些部门。 */
    departmentScope?: string[] | null;
  }
}

/**
 * 按部门范围判定的门禁（CONTRACT-274 §5：部长的 users.view、apply.view、apply.review、activity.read
 * 都是这一种——没有全站 allow，只有本部门 scope 的 allow）。用于列表类接口：命中就把范围写进
 * `req.departmentScope`，由路由处理函数在 SQL 里过滤；两种都没有命中时回 403。
 */
export function requireScopedPermission(node: string) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!loadSession(req)) return reply.code(401).send({ error: "unauthenticated", message: "请先登录" });
    const db = req.server.services.storage.db;
    const access = departmentScopedAccess(entriesForAccount(db, req.session!.account_id, Date.now()), node);
    if (access.kind === "none") return reply.code(403).send({ error: "forbidden", node, message: `需要「${node}」权限` });
    req.departmentScope = access.kind === "scoped" ? access.departments : null;
  };
}
