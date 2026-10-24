import type Database from "better-sqlite3";
import { CAPABILITY_TO_NODES, PERMISSION_NODES } from "../permission-nodes.js";
import { setExclusiveGroupMembership } from "../permissions.js";

/**
 * #274 账号/权限/操作记录统一迁移（SPEC §3.6「迁移步骤」）。可以重复执行：
 * 种子（节点、组、继承、默认条目）已存在不覆盖；账号身份与 role_assignments 映射只在账号还没有
 * 对应分组时写入；forum_users/account_profiles 只处理还没处理过的账号；audit_logs 复制按水位线
 * 增量进行。第二次运行时，每张表的 before/after 应该完全相等（迁移演练靠这个判断是否幂等）。
 *
 * 回滚：本迁移只加表、加列，不删旧表旧列，回滚就是部署上一个镜像；新表旧代码不会读。
 */

export type MigrationTableCount = { table: string; before: number; after: number };
export type UnmappedHead = { role_assignment_id: number; github_login: string; department_id: string };
export type MigrationReport = {
  tables: MigrationTableCount[];
  /** 旧 role_assignments 的 head（队长/部长）角色没有自动映射到新部门，需要站长在控制台重新任命。 */
  unmapped_heads: UnmappedHead[];
  /** 旧 CAPABILITIES 里找不到对应新节点的（GitHub 组织管理类），没有被静默丢弃，列在这里。 */
  unmapped_capabilities: string[];
  forum_users_linked_this_run: number;
  account_profiles_created_this_run: number;
  activity_events_copied_this_run: number;
  /** role_assignments 里 account_id 为空、从来没被映射过的行数（旧 GitHub 登录名没能关联到账号）。 */
  skipped_role_assignments: number;
};

function tableCount(db: Database.Database, table: string): number {
  return (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
}

// ---- 节点目录：代码是唯一来源，启动时整表同步（名字、说明、分类可能随代码改，和 ibuki 的
// register_permission_node 一致），不是「种子不覆盖」的那一类。 ----------------------------------
export function syncPermissionNodes(db: Database.Database) {
  const upsert = db.prepare(`
    INSERT INTO perm_nodes(node, domain, label, description, meta, sort)
    VALUES (@node, @domain, @label, @description, @meta, @sort)
    ON CONFLICT(node) DO UPDATE SET domain = excluded.domain, label = excluded.label,
      description = excluded.description, meta = excluded.meta, sort = excluded.sort
  `);
  const tx = db.transaction(() => {
    PERMISSION_NODES.forEach((def, index) => {
      upsert.run({ node: def.node, domain: def.domain, label: def.label, description: def.description, meta: def.meta ? 1 : 0, sort: index });
    });
  });
  tx();
}

// ---- 组、继承、默认条目种子 -------------------------------------------------------------------

type GroupKind = "level" | "department" | "title" | "custom";
type GroupSeed = {
  id: string; kind: GroupKind; name: string; description: string; weight: number;
  departmentId: string | null; icon: string | null; tone: string | null; sort: number; parents: string[];
};
type EntrySeed = { subjectId: string; node: string; value?: boolean; metaValue?: string; scope?: Record<string, unknown> };

/** 部门的字母色对照 SPEC §1：AI=Y 青绿，算法=U 蓝，硬件=C 靛蓝，网安=G 粉，管理=pill。图标只用 Remix，默认值，控制台可改。 */
const DEPARTMENTS = [
  { id: "ai", name: "AI部门", tone: "y", icon: "robot-2-line" },
  { id: "algo", name: "算法部门", tone: "u", icon: "code-s-slash-line" },
  { id: "hardware", name: "硬件部门", tone: "c", icon: "cpu-line" },
  { id: "security", name: "网安部门", tone: "g", icon: "shield-keyhole-line" },
  { id: "management", name: "管理部门", tone: "pill", icon: "government-line" },
] as const;

export function groupSeeds(): GroupSeed[] {
  const groups: GroupSeed[] = [
    { id: "level.visitor", kind: "level", name: "访客", description: "没登录，只读公开内容", weight: 0, departmentId: null, icon: null, tone: "ink", sort: 0, parents: [] },
    { id: "level.registered", kind: "level", name: "注册用户", description: "登录过，还没用邀请码升级", weight: 10, departmentId: null, icon: null, tone: "ink", sort: 10, parents: ["level.visitor"] },
    { id: "level.member", kind: "level", name: "极客班成员", description: "注册时或注册后用了邀请码", weight: 20, departmentId: null, icon: null, tone: "pill", sort: 20, parents: ["level.registered"] },
    { id: "level.alumni", kind: "level", name: "往届成员", description: "已毕业的学长学姐，读权限和成员一样，写权限由管理员配置", weight: 15, departmentId: null, icon: null, tone: "ink", sort: 15, parents: ["level.registered"] },
    // sort 排在 5 个真部门之后（CONTRACT-274 §1「GET /api/public/departments」要求的显示顺序：
    // AI、算法、硬件、网安、管理、无部门），不是 0。
    { id: "dept.none", kind: "department", name: "无部门", description: "没有分配部门的账号（默认）", weight: 0, departmentId: null, icon: "user-line", tone: "ink", sort: 99, parents: [] },
  ];
  DEPARTMENTS.forEach((dept, index) => {
    groups.push({ id: `dept.${dept.id}`, kind: "department", name: dept.name, description: `${dept.name}成员`, weight: 30, departmentId: null, icon: dept.icon, tone: dept.tone, sort: 10 + index, parents: [] });
    groups.push({ id: `title.${dept.id}.staff`, kind: "title", name: "部员", description: `${dept.name}部员`, weight: 40, departmentId: `dept.${dept.id}`, icon: dept.icon, tone: dept.tone, sort: 40 + index, parents: [`dept.${dept.id}`] });
    groups.push({ id: `title.${dept.id}.deputy`, kind: "title", name: "副部长", description: `${dept.name}副部长`, weight: 50, departmentId: `dept.${dept.id}`, icon: dept.icon, tone: dept.tone, sort: 50 + index, parents: [`dept.${dept.id}`] });
    groups.push({ id: `title.${dept.id}.head`, kind: "title", name: "部长", description: `${dept.name}部长`, weight: dept.id === "management" ? 80 : 60, departmentId: `dept.${dept.id}`, icon: dept.icon, tone: dept.tone, sort: 60 + index, parents: [`dept.${dept.id}`] });
  });
  groups.push({ id: "title.site.owner", kind: "title", name: "站长", description: "全站最高权限，不能被收回或删除", weight: 100, departmentId: null, icon: "vip-crown-2-line", tone: "pill", sort: 100, parents: [] });
  return groups;
}

export function entrySeeds(): EntrySeed[] {
  const entries: EntrySeed[] = [
    // 访客：最严限额，只读公开（SPEC §3.4「访客」行、§3.8 限额表）
    { subjectId: "level.visitor", node: "forum.read.public", value: true },
    { subjectId: "level.visitor", node: "meta.limit.read.per_minute", metaValue: "60" },
    { subjectId: "level.visitor", node: "meta.limit.search.per_minute", metaValue: "10" },
    { subjectId: "level.visitor", node: "meta.limit.apply.daily", metaValue: "0" },
    { subjectId: "level.visitor", node: "meta.limit.forum.topic.hourly", metaValue: "0" },
    { subjectId: "level.visitor", node: "meta.limit.forum.reply.hourly", metaValue: "0" },
    { subjectId: "level.visitor", node: "meta.limit.forum.react.hourly", metaValue: "0" },
    { subjectId: "level.visitor", node: "meta.limit.forum.upload.hourly", metaValue: "0" },
    // 注册用户
    { subjectId: "level.registered", node: "forum.read.registered", value: true },
    { subjectId: "level.registered", node: "apply.submit", value: true },
    { subjectId: "level.registered", node: "account.profile.edit", value: true },
    { subjectId: "level.registered", node: "account.invite.redeem", value: true },
    { subjectId: "level.registered", node: "account.cli.login", value: true },
    { subjectId: "level.registered", node: "meta.limit.read.per_minute", metaValue: "120" },
    { subjectId: "level.registered", node: "meta.limit.search.per_minute", metaValue: "20" },
    { subjectId: "level.registered", node: "meta.limit.apply.daily", metaValue: "3" },
    // 默认不允许发帖回帖（SPEC §3.8「注册用户」列），不写 forum.topic.create 等节点即不授权
    { subjectId: "level.registered", node: "meta.limit.forum.topic.hourly", metaValue: "0" },
    { subjectId: "level.registered", node: "meta.limit.forum.reply.hourly", metaValue: "0" },
    { subjectId: "level.registered", node: "meta.limit.forum.react.hourly", metaValue: "0" },
    { subjectId: "level.registered", node: "meta.limit.forum.upload.hourly", metaValue: "0" },
    // 极客班成员：几乎不限
    { subjectId: "level.member", node: "forum.read.member", value: true },
    { subjectId: "level.member", node: "forum.topic.create", value: true },
    { subjectId: "level.member", node: "forum.reply.create", value: true },
    { subjectId: "level.member", node: "forum.react", value: true },
    { subjectId: "level.member", node: "forum.sticker.use", value: true },
    { subjectId: "level.member", node: "forum.upload.image", value: true },
    { subjectId: "level.member", node: "competition.signup", value: true },
    { subjectId: "level.member", node: "competition.team", value: true },
    { subjectId: "level.member", node: "meta.limit.read.per_minute", metaValue: "300" },
    { subjectId: "level.member", node: "meta.limit.search.per_minute", metaValue: "60" },
    { subjectId: "level.member", node: "meta.limit.apply.daily", metaValue: "-1" },
    { subjectId: "level.member", node: "meta.limit.forum.topic.hourly", metaValue: "20" },
    { subjectId: "level.member", node: "meta.limit.forum.reply.hourly", metaValue: "60" },
    { subjectId: "level.member", node: "meta.limit.forum.react.hourly", metaValue: "300" },
    { subjectId: "level.member", node: "meta.limit.forum.upload.hourly", metaValue: "60" },
    // 往届成员：读和成员一样，写权限留给管理员在控制台配置（这里不预置写节点）
    { subjectId: "level.alumni", node: "forum.read.member", value: true },
    { subjectId: "level.alumni", node: "meta.limit.read.per_minute", metaValue: "300" },
    { subjectId: "level.alumni", node: "meta.limit.search.per_minute", metaValue: "60" },
  ];
  // 部门：成员只靠部门组拿到「本部门分类」范围内的版务权限（SPEC §3.4 部门行）。分类 id 是
  // app/forum/content/curation.json 里真实的论坛分类（#276 正式建分类表之前，这张对照表是唯一来源，
  // 改分类要连这里一起改）。dept.none 没有对应分类，不发这条权限。
  const DEPARTMENT_FORUM_CATEGORIES: Record<string, string[]> = {
    ai: ["c-ai"],
    algo: ["c-competitions"],
    hardware: ["c-competitions"],
    security: ["c-competitions"],
    management: ["c-announcements", "c-exam", "c-courses", "c-careers"],
  };
  for (const dept of DEPARTMENTS) {
    const categories = DEPARTMENT_FORUM_CATEGORIES[dept.id];
    if (!categories) continue;
    entries.push({ subjectId: `dept.${dept.id}`, node: "forum.moderate.*", value: true, scope: { category: categories } });
  }
  // 各部门部长（管理部门除外，见下）：本部门的用户与投递查看、操作记录、部门管理
  for (const dept of DEPARTMENTS) {
    if (dept.id === "management") continue;
    const scope = { department: [`dept.${dept.id}`] };
    entries.push({ subjectId: `title.${dept.id}.head`, node: "console.access", value: true });
    entries.push({ subjectId: `title.${dept.id}.head`, node: "users.view", value: true, scope });
    entries.push({ subjectId: `title.${dept.id}.head`, node: "apply.view", value: true, scope });
    entries.push({ subjectId: `title.${dept.id}.head`, node: "apply.review", value: true, scope });
    entries.push({ subjectId: `title.${dept.id}.head`, node: "activity.read", value: true, scope });
    entries.push({ subjectId: `title.${dept.id}.head`, node: "dept.manage", value: true, scope });
  }
  // 管理部部长：全站级权限（SPEC §3.4「title.management.head」行），不含根通配 `*`
  for (const node of ["console.access", "users.*", "perm.view", "activity.*", "gitlab.*", "competition.*", "invite.manage"]) {
    entries.push({ subjectId: "title.management.head", node, value: true });
  }
  // 站长：全部，且不能被收回（接口层强制，这里只是种子）
  entries.push({ subjectId: "title.site.owner", node: "*", value: true });
  return entries;
}

// ---- 种子只应用一次的台账（#274 残留修复 C） ---------------------------------------------------
// 旧写法判断「现在的状态符不符合种子要的样子」（组/边用 INSERT OR IGNORE，条目靠精确值匹配再决定
// 插不插）：这分不清「所有者故意改掉了」和「这台账号从来没种过」，服务器每次重启都会把所有者删掉的
// 继承边、删掉的条目、收紧过的 meta 又种回来；role_assignments 的映射同理——alumni 的 weight<15、
// head 的 hasDepartment 这类按「现在状态」判断的守卫，所有者降级/清空之后重跑又会把人升回去。
// 改成按稳定 key 的台账：一个 key 只应用一次，应用过就不再看种子要它变成什么样，所有者怎么改都算数。
function seedApplied(db: Database.Database, key: string): boolean {
  return !!db.prepare("SELECT 1 FROM perm_seed_applied WHERE key = ?").get(key);
}
function markSeedApplied(db: Database.Database, key: string, now: number) {
  db.prepare("INSERT OR IGNORE INTO perm_seed_applied(key, applied_at) VALUES (?, ?)").run(key, now);
}

/**
 * 给台账表刚创建那一刻、数据库里已经有迁移产物的情况（已经跑过旧版迁移很多次的库）补一份底账：
 * 把当前已经存在的组、继承边、条目、role_assignments 映射都记成「早就应用过」，不然下一次重启会把
 * 台账当成全新的、把所有这些年的种子重新种一遍，覆盖所有者这期间做的改动。只在台账是空表时做，
 * 台账一旦有内容就说明已经接管，不再回填（正常情况下只会在升级后的第一次启动触发一次）。
 * 已知限制：如果所有者在台账上线之前就删掉过某条种子（现在已经不存在了），回填看不到已经删除的东西，
 * 这一条会在台账上线后的这一次启动被重新种回来、但从此以后台账记住、不会再种第二次——这是追溯补台账
 * 本身的局限（补的是「现在」的底账，不是完整历史），不是本次要解决的回归。
 */
function backfillSeedLedger(db: Database.Database, now: number) {
  const empty = (db.prepare("SELECT COUNT(*) AS n FROM perm_seed_applied").get() as { n: number }).n === 0;
  if (!empty) return;
  const tx = db.transaction(() => {
    for (const group of db.prepare("SELECT id FROM perm_groups").all() as { id: string }[]) {
      markSeedApplied(db, `group:${group.id}`, now);
    }
    for (const parent of db.prepare("SELECT group_id, parent_id FROM perm_group_parents").all() as { group_id: string; parent_id: string }[]) {
      markSeedApplied(db, `parent:${parent.group_id}:${parent.parent_id}`, now);
    }
    for (const entry of db.prepare("SELECT subject_id, node, scope FROM perm_entries WHERE subject_type = 'group'").all() as { subject_id: string; node: string; scope: string }[]) {
      markSeedApplied(db, `entry:${entry.subject_id}:${entry.node}:${entry.scope}`, now);
    }
    for (const row of db.prepare("SELECT id FROM role_assignments WHERE account_id IS NOT NULL").all() as { id: number }[]) {
      markSeedApplied(db, `role_assignment:${row.id}`, now);
    }
  });
  tx();
}

export function seedGroupsAndEntries(db: Database.Database, now: number) {
  backfillSeedLedger(db, now);
  const insertGroup = db.prepare(`
    INSERT OR IGNORE INTO perm_groups(id, kind, name, description, weight, department_id, icon, tone, sort, system, created_at, updated_at)
    VALUES (@id, @kind, @name, @description, @weight, @departmentId, @icon, @tone, @sort, 1, @now, @now)
  `);
  const insertParent = db.prepare("INSERT OR IGNORE INTO perm_group_parents(group_id, parent_id) VALUES (?, ?)");
  const insertEntry = db.prepare(`
    INSERT INTO perm_entries(subject_type, subject_id, node, value, meta_value, scope, expires_at, granted_by, created_at)
    VALUES ('group', ?, ?, ?, ?, ?, NULL, 'migration:2026-10-yugc-v2', ?)
  `);
  const tx = db.transaction(() => {
    for (const group of groupSeeds()) {
      const groupKey = `group:${group.id}`;
      if (!seedApplied(db, groupKey)) {
        insertGroup.run({ id: group.id, kind: group.kind, name: group.name, description: group.description, weight: group.weight, departmentId: group.departmentId, icon: group.icon, tone: group.tone, sort: group.sort, now });
        markSeedApplied(db, groupKey, now);
      }
      for (const parent of group.parents) {
        const parentKey = `parent:${group.id}:${parent}`;
        if (!seedApplied(db, parentKey)) {
          insertParent.run(group.id, parent);
          markSeedApplied(db, parentKey, now);
        }
      }
    }
    for (const entry of entrySeeds()) {
      const value = entry.value === undefined ? null : entry.value ? 1 : 0;
      const metaValue = entry.metaValue ?? null;
      const scope = JSON.stringify(entry.scope ?? {});
      const entryKey = `entry:${entry.subjectId}:${entry.node}:${scope}`;
      if (!seedApplied(db, entryKey)) {
        insertEntry.run(entry.subjectId, entry.node, value, metaValue, scope, now);
        markSeedApplied(db, entryKey, now);
      }
    }
  });
  tx();
}

// ---- 步骤 2：按账号定身份（SPEC §3.6 第 2 条） -------------------------------------------------

export function assignAccountIdentities(db: Database.Database, now: number) {
  const hasLevel = db.prepare("SELECT 1 FROM perm_members pm JOIN perm_groups g ON g.id = pm.group_id WHERE pm.account_id = ? AND g.kind = 'level'");
  const addTitle = db.prepare("INSERT OR IGNORE INTO perm_members(account_id, group_id, expires_at, granted_by, created_at) VALUES (?, ?, NULL, 'migration:2026-10-yugc-v2', ?)");
  const accounts = db.prepare("SELECT id, org_role, invite_code_id FROM users WHERE status <> 'merged'").all() as
    { id: string; org_role: string | null; invite_code_id: number | null }[];
  const tx = db.transaction(() => {
    for (const account of accounts) {
      if (hasLevel.get(account.id)) continue; // 已经分过身份的不重复分（可能是重跑，或控制台后来改过）
      if (account.org_role === "admin") {
        setExclusiveGroupMembership(db, account.id, "level.member", now, "migration:2026-10-yugc-v2");
        addTitle.run(account.id, "title.site.owner", now);
      } else if (account.org_role === "member" || account.invite_code_id !== null) {
        setExclusiveGroupMembership(db, account.id, "level.member", now, "migration:2026-10-yugc-v2");
      } else {
        setExclusiveGroupMembership(db, account.id, "level.registered", now, "migration:2026-10-yugc-v2");
      }
    }
  });
  tx();
}

// ---- 步骤 3：role_assignments 映射（SPEC §3.6 第 3 条） -----------------------------------------

export function mapRoleAssignments(db: Database.Database, now: number) {
  backfillSeedLedger(db, now);
  const rows = db.prepare("SELECT id, github_login, account_id, role, department_id FROM role_assignments WHERE account_id IS NOT NULL").all() as
    { id: number; github_login: string; account_id: string; role: string; department_id: string }[];
  const addTitle = db.prepare("INSERT OR IGNORE INTO perm_members(account_id, group_id, expires_at, granted_by, created_at) VALUES (?, ?, NULL, 'migration:2026-10-yugc-v2:role_assignments', ?)");
  const levelWeight = db.prepare("SELECT g.weight AS weight FROM perm_members pm JOIN perm_groups g ON g.id = pm.group_id WHERE pm.account_id = ? AND g.kind = 'level'");
  const hasDepartment = db.prepare("SELECT 1 FROM perm_members pm JOIN perm_groups g ON g.id = pm.group_id WHERE pm.account_id = ? AND g.kind = 'department'");
  const tx = db.transaction(() => {
    for (const row of rows) {
      // 每一条 role_assignments 只映射一次，不管这次映射有没有真的改动账号（比如 alumni/head 分支的
      // 守卫判断「不用动」）：标记过之后，所有者后续不管怎么改这个账号的身份，重跑都不再回头重新判断。
      const key = `role_assignment:${row.id}`;
      if (seedApplied(db, key)) continue;
      if (row.role === "captain") {
        addTitle.run(row.account_id, "title.site.owner", now);
      } else if (row.role === "member") {
        setExclusiveGroupMembership(db, row.account_id, "level.member", now, "migration:2026-10-yugc-v2:role_assignments");
      } else if (row.role === "alumni") {
        // 不降级：已经是成员（或更高）的账号不因为旧的 alumni 记录被退回往届成员
        const current = levelWeight.get(row.account_id) as { weight: number } | undefined;
        if (!current || current.weight < 15) setExclusiveGroupMembership(db, row.account_id, "level.alumni", now, "migration:2026-10-yugc-v2:role_assignments");
      } else if (row.role === "head") {
        // 旧部门（招新/技术/社区/项目）和新部门对不上，不硬映射；先进 dept.none，由站长在控制台重新任命。
        if (!hasDepartment.get(row.account_id)) setExclusiveGroupMembership(db, row.account_id, "dept.none", now, "migration:2026-10-yugc-v2:role_assignments");
      }
      markSeedApplied(db, key, now);
    }
  });
  tx();
}

/** 迁移报告用：目前还卡在 dept.none、原本是旧「队长/部长」角色的账号——站长需要在控制台重新任命。 */
function unmappedHeadsSnapshot(db: Database.Database): UnmappedHead[] {
  return db.prepare(`
    SELECT ra.id AS role_assignment_id, ra.github_login AS github_login, ra.department_id AS department_id
    FROM role_assignments ra
    JOIN perm_members pm ON pm.account_id = ra.account_id AND pm.group_id = 'dept.none'
    WHERE ra.role = 'head' AND ra.account_id IS NOT NULL
    ORDER BY ra.id
  `).all() as UnmappedHead[];
}

// ---- 步骤 4：旧部门归档 ------------------------------------------------------------------------
// 注意：`departments` 的默认 4 行由 lib/role-store.ts 的 createRoleStore() 播种，那一步在
// services.ts 里排在 createDatabase() 之后——比这份迁移（挂在 createDatabase() 内部）晚。
// 所以这一步不在 runYugcV2Migration() 的编排里调用，而是由 services.ts 在 createRoleStore()
// 之后单独调用一次，顺序才对；这里只是导出函数本身，保持「不覆盖所有者改动」之外的逻辑集中。

export function archiveOldDepartments(db: Database.Database) {
  db.prepare("UPDATE departments SET archived = 1 WHERE archived = 0").run();
}

// ---- 步骤 5：forum_users.account_id 回填 --------------------------------------------------------

export function backfillForumUserAccounts(db: Database.Database): number {
  const result = db.prepare(`
    UPDATE forum_users SET account_id = (
      SELECT i.user_id FROM identities i WHERE i.provider = 'github' AND i.provider_uid = CAST(forum_users.github_user_id AS TEXT)
    )
    WHERE account_id IS NULL AND github_user_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM identities i WHERE i.provider = 'github' AND i.provider_uid = CAST(forum_users.github_user_id AS TEXT))
  `).run();
  return result.changes;
}

// ---- 步骤 6：account_profiles 建档 ---------------------------------------------------------------

function synthesizeUsername(candidate: string, accountId: string): string {
  let base = candidate.toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (base.length < 3) base = `${base}${accountId.replace(/-/g, "")}`.toLowerCase();
  if (base.length < 3) base = `acct${accountId.replace(/-/g, "")}`;
  return base.slice(0, 20);
}

export function buildAccountProfiles(db: Database.Database, now: number): number {
  const accounts = db.prepare("SELECT id FROM users WHERE status <> 'merged' AND id NOT IN (SELECT account_id FROM account_profiles)").all() as { id: string }[];
  const usernameTaken = db.prepare("SELECT 1 FROM account_profiles WHERE username = ? COLLATE NOCASE");
  const githubIdentity = db.prepare("SELECT login FROM identities WHERE user_id = ? AND provider = 'github'");
  const emailIdentity = db.prepare("SELECT email FROM identities WHERE user_id = ? AND provider = 'email' AND email IS NOT NULL ORDER BY created_at LIMIT 1");
  const forumUser = db.prepare("SELECT display_name, bio, avatar_hash FROM forum_users WHERE account_id = ?");
  const insert = db.prepare("INSERT INTO account_profiles(account_id, username, display_name, bio, avatar_hash, prefs, updated_at) VALUES (?, ?, ?, ?, ?, '{}', ?)");
  // 论坛头像和账号头像都是居中裁正方形之后重新编码的 WebP（lib/forum-avatar.ts / lib/account-avatar.ts），
  // 字节本身可以直接搬过去，不用重新编码；只是两边表分开存，不搬字节的话 account_profiles.avatar_hash
  // 会指向一个 account_avatars 里根本不存在的 hash，GET /api/identity/avatar/:file 404（#274 残留修复 H）。
  const forumAvatarData = db.prepare("SELECT data FROM forum_avatars WHERE hash = ?");
  const copyAvatarData = db.prepare("INSERT OR IGNORE INTO account_avatars(hash, data, mime, created_at) VALUES (?, ?, 'image/webp', ?)");
  let created = 0;
  const tx = db.transaction(() => {
    for (const account of accounts) {
      const github = githubIdentity.get(account.id) as { login: string } | undefined;
      const email = emailIdentity.get(account.id) as { email: string } | undefined;
      const forum = forumUser.get(account.id) as { display_name: string; bio: string; avatar_hash: string | null } | undefined;
      const candidate = github?.login || (email?.email ? email.email.split("@")[0] : "") || "";
      let username = synthesizeUsername(candidate, account.id);
      let suffix = 1;
      const base = username;
      while (usernameTaken.get(username)) username = `${base}${++suffix}`.slice(0, 24);
      const displayName = forum?.display_name || github?.login || (email?.email ? email.email.split("@")[0] : "") || username;
      insert.run(account.id, username, displayName, forum?.bio ?? "", forum?.avatar_hash ?? null, now);
      if (forum?.avatar_hash) {
        const avatar = forumAvatarData.get(forum.avatar_hash) as { data: Buffer } | undefined;
        if (avatar) copyAvatarData.run(forum.avatar_hash, avatar.data, now);
      }
      created++;
    }
  });
  tx();
  return created;
}

// ---- 步骤 7：audit_logs → activity_events（按水位线增量，保证可重跑） ---------------------------

/**
 * 邀请链接 token 是「持有即可用」的凭据（和旧 /api/console/audit 的 redactAuditRow 同一个口径，
 * 见 29bd82df）：`invite_link.*` 的 target、`invite.*` 里 `public:<token>` 形式的 actor，复制进
 * activity_events 之前只留前 6 位，不把完整 token 永久写进新表（#274 残留修复 I）。
 */
const INVITE_TOKEN_PREVIEW = 6;
function maskInviteToken(token: string): string {
  return `${token.slice(0, INVITE_TOKEN_PREVIEW)}…`;
}
function maskLegacyTarget(action: string, target: string | null): string | null {
  return action.startsWith("invite_link.") && target ? maskInviteToken(target) : target;
}
function maskLegacyActor(action: string, actor: string): string {
  return action.startsWith("invite.") && actor.startsWith("public:") ? `public:${maskInviteToken(actor.slice("public:".length))}` : actor;
}

export function copyAuditLogsToActivity(db: Database.Database): number {
  const watermarkRow = db.prepare("SELECT value FROM perm_state WHERE key = 'audit_logs_migrated_through'").get() as { value: number } | undefined;
  const watermark = watermarkRow?.value ?? 0;
  const rows = db.prepare("SELECT * FROM audit_logs WHERE id > ? ORDER BY id ASC").all(watermark) as
    { id: number; actor: string; action: string; target: string | null; details: string | null; ip: string | null; created_at: number; actor_account_id: string | null }[];
  if (rows.length === 0) return 0;
  const insert = db.prepare(`
    INSERT INTO activity_events(at, account_id, visitor_id, surface, action, target_type, target_id, outcome, ip, ua, request_id, meta)
    VALUES (?, ?, NULL, 'console', ?, NULL, ?, 'ok', ?, NULL, NULL, ?)
  `);
  const tx = db.transaction(() => {
    for (const row of rows) {
      const meta = JSON.stringify({ legacy_actor: maskLegacyActor(row.action, row.actor), legacy_details: row.details ? JSON.parse(row.details) : null });
      insert.run(row.created_at, row.actor_account_id, row.action, maskLegacyTarget(row.action, row.target), row.ip, meta);
    }
    db.prepare("INSERT INTO perm_state(key, value) VALUES ('audit_logs_migrated_through', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .run(rows[rows.length - 1].id);
  });
  tx();
  return rows.length;
}

// ---- 步骤 8：编排 + 报告 -----------------------------------------------------------------------

const REPORT_TABLES = [
  "users", "identities", "forum_users", "role_assignments", "departments", "invite_codes", "audit_logs", "applications",
  "perm_nodes", "perm_groups", "perm_group_parents", "perm_entries", "perm_members", "account_profiles", "activity_events",
];

export function runYugcV2Migration(db: Database.Database, now: number = Date.now()): MigrationReport {
  const before = Object.fromEntries(REPORT_TABLES.map(table => [table, tableCount(db, table)]));

  syncPermissionNodes(db);
  seedGroupsAndEntries(db, now);
  assignAccountIdentities(db, now);
  mapRoleAssignments(db, now);
  // archiveOldDepartments() 不在这里调用：见上面步骤 4 的注释，它由 services.ts 在
  // createRoleStore() 播种默认部门之后单独调用。
  const forumLinked = backfillForumUserAccounts(db);
  const profilesCreated = buildAccountProfiles(db, now);
  const activityCopied = copyAuditLogsToActivity(db);

  const after = Object.fromEntries(REPORT_TABLES.map(table => [table, tableCount(db, table)]));
  return {
    tables: REPORT_TABLES.map(table => ({ table, before: before[table], after: after[table] })),
    unmapped_heads: unmappedHeadsSnapshot(db),
    unmapped_capabilities: Object.entries(CAPABILITY_TO_NODES).filter(([, nodes]) => nodes === null).map(([capability]) => capability),
    forum_users_linked_this_run: forumLinked,
    account_profiles_created_this_run: profilesCreated,
    activity_events_copied_this_run: activityCopied,
    skipped_role_assignments: (db.prepare("SELECT COUNT(*) AS n FROM role_assignments WHERE account_id IS NULL").get() as { n: number }).n,
  };
}
