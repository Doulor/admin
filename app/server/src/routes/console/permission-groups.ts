import type { FastifyInstance } from "fastify";
import { requirePermission } from "../../middleware/require-permission.js";
import { requireStepUp } from "../../middleware/require-step-up.js";
import { isKnownNode, PERMISSION_NODES } from "../../lib/permission-nodes.js";
import type { Scope } from "../../lib/permissions.js";

const CUSTOM_GROUP_ID_PATTERN = /^custom\.[a-z0-9_]+$/;

type GroupRow = {
  id: string; kind: string; name: string; description: string; weight: number;
  department_id: string | null; icon: string | null; tone: string | null; sort: number; system: number;
};
type EntryRow = {
  id: number; subject_id: string; node: string; value: number | null; meta_value: string | null; scope: string; expires_at: number | null;
};

/** entries.add 允许写具体节点或通配前缀（例如 forum.moderate.*、users.*），但必须真的命中至少一个已登记节点，
 * 拦掉拼错的域名；不是通用的「任意字符串+ .*」。 */
function isAcceptableEntryNode(node: string): boolean {
  if (node === "*") return true;
  if (isKnownNode(node)) return true;
  if (node.endsWith(".*")) {
    const prefix = node.slice(0, -1);
    return PERMISSION_NODES.some(def => def.node.startsWith(prefix));
  }
  return false;
}

/** 把 newParents 接上 group 之后，group 能不能顺着继承边绕回自己。 */
function wouldCreateCycle(db: import("better-sqlite3").Database, groupId: string, newParents: string[]): boolean {
  const edges = new Map<string, string[]>();
  for (const row of db.prepare("SELECT group_id, parent_id FROM perm_group_parents WHERE group_id <> ?").all(groupId) as { group_id: string; parent_id: string }[]) {
    const list = edges.get(row.group_id);
    if (list) list.push(row.parent_id); else edges.set(row.group_id, [row.parent_id]);
  }
  edges.set(groupId, newParents);
  const stack = [...newParents];
  const visited = new Set<string>();
  while (stack.length) {
    const current = stack.pop()!;
    if (current === groupId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const parent of edges.get(current) ?? []) stack.push(parent);
  }
  return false;
}

function entryView(row: EntryRow) {
  return { id: row.id, node: row.node, value: row.value === null ? null : row.value === 1, meta_value: row.meta_value, scope: JSON.parse(row.scope || "{}"), expires_at: row.expires_at };
}

/**
 * 权限组 CRUD 与成员管理（CONTRACT-274 §5）：department、title、level 组都是迁移种子建出来的 `system=1` 行，
 * 名字、说明、权重、图标、色调、继承、条目都能在这里改（部门/称号不再有专门的管理接口）；只有 `custom.<slug>`
 * 是运行时新建的（`system=0`），能被删除。身份互斥（level/department 组每账号最多一个）由
 * lib/permissions.ts 的 setExclusiveGroupMembership() 保证。
 */
export default async function consolePermissionGroupsRoutes(app: FastifyInstance) {
  const { permissions, storage } = app.services;
  const db = storage.db;
  const view = { preHandler: requirePermission("perm.view") };
  const manageWrite = { preHandler: [requirePermission("perm.manage"), requireStepUp], config: { rateLimit: { max: 30, timeWindow: "1 minute" } } };

  function fullView() {
    const groups = db.prepare("SELECT id, kind, name, description, weight, department_id, icon, tone, sort, system FROM perm_groups ORDER BY sort ASC, id ASC").all() as GroupRow[];
    const parentsOf = new Map<string, string[]>();
    for (const row of db.prepare("SELECT group_id, parent_id FROM perm_group_parents").all() as { group_id: string; parent_id: string }[]) {
      const list = parentsOf.get(row.group_id);
      if (list) list.push(row.parent_id); else parentsOf.set(row.group_id, [row.parent_id]);
    }
    const entriesOf = new Map<string, EntryRow[]>();
    for (const row of db.prepare("SELECT id, subject_id, node, value, meta_value, scope, expires_at FROM perm_entries WHERE subject_type = 'group'").all() as EntryRow[]) {
      const list = entriesOf.get(row.subject_id);
      if (list) list.push(row); else entriesOf.set(row.subject_id, [row]);
    }
    const counts = new Map((db.prepare("SELECT group_id, COUNT(*) AS n FROM perm_members GROUP BY group_id").all() as { group_id: string; n: number }[]).map(row => [row.group_id, row.n]));
    return groups.map(group => ({
      id: group.id, kind: group.kind, name: group.name, description: group.description, weight: group.weight,
      department_id: group.department_id, icon: group.icon, tone: group.tone, sort: group.sort, system: group.system === 1,
      parents: parentsOf.get(group.id) ?? [], member_count: counts.get(group.id) ?? 0,
      entries: (entriesOf.get(group.id) ?? []).map(entryView),
    }));
  }

  app.get("/api/console/permission-groups", view, async () => ({ groups: fullView() }));

  app.post<{ Body: { id: string; name: string; description?: string; weight: number; parents?: string[]; icon?: string; tone?: string } }>(
    "/api/console/permission-groups", manageWrite, async (req, reply) => {
      const { id, name, description, weight, parents, icon, tone } = req.body;
      if (!CUSTOM_GROUP_ID_PATTERN.test(id)) return reply.code(400).send({ error: "invalid_group_id", message: "自定义组 id 必须是 custom.<字母数字下划线>" });
      if (db.prepare("SELECT 1 FROM perm_groups WHERE id = ?").get(id)) return reply.code(409).send({ error: "group_exists", message: "这个组 id 已经存在" });
      const parentIds = parents ?? [];
      for (const parentId of parentIds) {
        if (!db.prepare("SELECT 1 FROM perm_groups WHERE id = ?").get(parentId)) return reply.code(400).send({ error: "invalid_parent", message: `继承的组不存在：${parentId}` });
      }
      const now = Date.now();
      db.transaction(() => {
        db.prepare(`INSERT INTO perm_groups(id, kind, name, description, weight, department_id, icon, tone, sort, system, created_at, updated_at)
          VALUES (?, 'custom', ?, ?, ?, NULL, ?, ?, ?, 0, ?, ?)`).run(id, name, description ?? "", weight, icon ?? null, tone ?? null, weight, now, now);
        const insertParent = db.prepare("INSERT INTO perm_group_parents(group_id, parent_id) VALUES (?, ?)");
        for (const parentId of parentIds) insertParent.run(id, parentId);
      })();
      permissions.bump();
      storage.audit(null, req.session!, "perm.group.create", id, { name, parents: parentIds }, req.ip);
      return reply.code(201).send(fullView().find(group => group.id === id));
    },
  );

  app.patch<{ Params: { id: string }; Body: {
    name?: string; description?: string; weight?: number; parents?: string[]; icon?: string | null; tone?: string | null; sort?: number;
    entries?: { add?: { node: string; value?: boolean; meta_value?: string; scope?: Scope; expires_at?: number }[]; remove?: number[] };
  } }>("/api/console/permission-groups/:id", manageWrite, async (req, reply) => {
    const { id } = req.params;
    const group = db.prepare("SELECT id FROM perm_groups WHERE id = ?").get(id);
    if (!group) return reply.code(404).send({ error: "not_found", message: "没有这个权限组" });
    const { name, description, weight, parents, icon, tone, sort, entries } = req.body;
    if (parents !== undefined) {
      for (const parentId of parents) {
        if (!db.prepare("SELECT 1 FROM perm_groups WHERE id = ?").get(parentId)) return reply.code(400).send({ error: "invalid_parent", message: `继承的组不存在：${parentId}` });
      }
      if (wouldCreateCycle(db, id, parents)) return reply.code(400).send({ error: "group_cycle", message: "这样会让继承关系绕成一个环" });
    }
    for (const addition of entries?.add ?? []) {
      if (!isAcceptableEntryNode(addition.node)) return reply.code(400).send({ error: "unknown_node", message: `不是一个已登记的权限节点：${addition.node}` });
      if ((addition.value === undefined) === (addition.meta_value === undefined)) {
        return reply.code(400).send({ error: "invalid_entry", message: "一条条目必须只给 value 或只给 meta_value，不能都给或都不给" });
      }
    }
    const fields: string[] = [];
    const values: unknown[] = [];
    if (name !== undefined) { fields.push("name = ?"); values.push(name); }
    if (description !== undefined) { fields.push("description = ?"); values.push(description); }
    if (weight !== undefined) { fields.push("weight = ?"); values.push(weight); }
    if (icon !== undefined) { fields.push("icon = ?"); values.push(icon); }
    if (tone !== undefined) { fields.push("tone = ?"); values.push(tone); }
    if (sort !== undefined) { fields.push("sort = ?"); values.push(sort); }
    db.transaction(() => {
      if (fields.length) {
        fields.push("updated_at = ?"); values.push(Date.now());
        db.prepare(`UPDATE perm_groups SET ${fields.join(", ")} WHERE id = ?`).run(...values, id);
      }
      if (parents !== undefined) {
        db.prepare("DELETE FROM perm_group_parents WHERE group_id = ?").run(id);
        const insertParent = db.prepare("INSERT INTO perm_group_parents(group_id, parent_id) VALUES (?, ?)");
        for (const parentId of parents) insertParent.run(id, parentId);
      }
      if (entries?.remove?.length) {
        const placeholders = entries.remove.map(() => "?").join(",");
        db.prepare(`DELETE FROM perm_entries WHERE subject_type = 'group' AND subject_id = ? AND id IN (${placeholders})`).run(id, ...entries.remove);
      }
      if (entries?.add?.length) {
        const insertEntry = db.prepare(`INSERT INTO perm_entries(subject_type, subject_id, node, value, meta_value, scope, expires_at, granted_by, created_at)
          VALUES ('group', ?, ?, ?, ?, ?, ?, ?, ?)`);
        const now = Date.now();
        for (const addition of entries.add) {
          insertEntry.run(id, addition.node, addition.value === undefined ? null : addition.value ? 1 : 0, addition.meta_value ?? null,
            JSON.stringify(addition.scope ?? {}), addition.expires_at ?? null, req.session!.login, now);
        }
      }
    })();
    permissions.bump();
    storage.audit(null, req.session!, "perm.group.update", id, { fields: Object.keys(req.body) }, req.ip);
    return fullView().find(item => item.id === id);
  });

  app.delete<{ Params: { id: string } }>("/api/console/permission-groups/:id", manageWrite, async (req, reply) => {
    const { id } = req.params;
    const group = db.prepare("SELECT system FROM perm_groups WHERE id = ?").get(id) as { system: number } | undefined;
    if (!group) return reply.code(404).send({ error: "not_found", message: "没有这个权限组" });
    if (group.system === 1) return reply.code(409).send({ error: "system_group", message: "系统内置的组不能删除" });
    db.transaction(() => {
      db.prepare("DELETE FROM perm_entries WHERE subject_type = 'group' AND subject_id = ?").run(id);
      db.prepare("DELETE FROM perm_members WHERE group_id = ?").run(id);
      db.prepare("DELETE FROM perm_groups WHERE id = ?").run(id);
    })();
    permissions.bump();
    storage.audit(null, req.session!, "perm.group.delete", id, undefined, req.ip);
    return { ok: true };
  });

  app.get<{ Params: { id: string } }>("/api/console/permission-groups/:id/members", view, async (req, reply) => {
    if (!db.prepare("SELECT 1 FROM perm_groups WHERE id = ?").get(req.params.id)) return reply.code(404).send({ error: "not_found", message: "没有这个权限组" });
    const members = db.prepare(`
      SELECT pm.account_id AS account_id, p.username AS username, p.display_name AS display_name, p.avatar_hash AS avatar_hash,
        pm.expires_at AS expires_at, pm.granted_by AS granted_by, pm.created_at AS created_at
      FROM perm_members pm LEFT JOIN account_profiles p ON p.account_id = pm.account_id
      WHERE pm.group_id = ? ORDER BY pm.created_at ASC
    `).all(req.params.id) as { account_id: string; username: string | null; display_name: string | null; avatar_hash: string | null; expires_at: number | null; granted_by: string; created_at: number }[];
    return {
      members: members.map(row => ({
        account_id: row.account_id, username: row.username, display_name: row.display_name,
        avatar_url: row.avatar_hash ? `/api/identity/avatar/${row.avatar_hash}.webp` : null,
        expires_at: row.expires_at, granted_by: row.granted_by, created_at: row.created_at,
      })),
    };
  });

  app.post<{ Params: { id: string }; Body: { account_id: string; expires_at?: number } }>(
    "/api/console/permission-groups/:id/members", manageWrite, async (req, reply) => {
      const { id } = req.params;
      const group = db.prepare("SELECT kind FROM perm_groups WHERE id = ?").get(id) as { kind: string } | undefined;
      if (!group) return reply.code(404).send({ error: "not_found", message: "没有这个权限组" });
      if (!db.prepare("SELECT 1 FROM users WHERE id = ? AND status <> 'merged'").get(req.body.account_id)) {
        return reply.code(404).send({ error: "account_not_found", message: "没有这个账号" });
      }
      const now = Date.now();
      if (group.kind === "level" || group.kind === "department") {
        // level、department 组每账号最多一个：同一事务里先删旧的再插入新的（lib/permissions.ts 的同一条规则）。
        db.transaction(() => {
          db.prepare("DELETE FROM perm_members WHERE account_id = ? AND group_id IN (SELECT id FROM perm_groups WHERE kind = ?)").run(req.body.account_id, group.kind);
          db.prepare("INSERT INTO perm_members(account_id, group_id, expires_at, granted_by, created_at) VALUES (?, ?, ?, ?, ?)")
            .run(req.body.account_id, id, req.body.expires_at ?? null, req.session!.login, now);
        })();
      } else {
        db.prepare("INSERT OR REPLACE INTO perm_members(account_id, group_id, expires_at, granted_by, created_at) VALUES (?, ?, ?, ?, ?)")
          .run(req.body.account_id, id, req.body.expires_at ?? null, req.session!.login, now);
      }
      permissions.bump();
      storage.audit(null, req.session!, "perm.group.member.add", id, { account_id: req.body.account_id }, req.ip);
      return reply.code(201).send({ ok: true });
    },
  );

  app.delete<{ Params: { id: string; account_id: string } }>(
    "/api/console/permission-groups/:id/members/:account_id", manageWrite, async (req, reply) => {
      const removed = db.prepare("DELETE FROM perm_members WHERE group_id = ? AND account_id = ?").run(req.params.id, req.params.account_id);
      if (removed.changes === 0) return reply.code(404).send({ error: "not_found", message: "这个账号不在这个组里" });
      permissions.bump();
      storage.audit(null, req.session!, "perm.group.member.remove", req.params.id, { account_id: req.params.account_id }, req.ip);
      return { ok: true };
    },
  );
}
