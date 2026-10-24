// 「权限」页（SPEC §3.3–§3.5、CONTRACT §5）：组的分类排序、条目与范围的说法、新建与修改的请求体、解释结果的来源链。
// 纯函数，tests/console 直接测。真正的求值在服务端，这里只把接口给的数据写成人看得懂的样子。
import { dateEdge } from "./competitions";
import { PERMISSION_DOMAINS, nodeDomain } from "./permission-nodes";
import type {
  PermissionEntry, PermissionEntryInput, PermissionExplainHit, PermissionGroup, PermissionGroupCreate, PermissionGroupKind,
  PermissionGroupPatch, PermissionNodeDef,
} from "./types";

export const GROUP_KIND_ORDER: PermissionGroupKind[] = ["level", "department", "title", "custom"];
export const GROUP_KIND_TEXT: Record<PermissionGroupKind, string> = { level: "身份", department: "部门", title: "称号", custom: "自定义" };

const kindIndex = (kind: string) => {
  const index = GROUP_KIND_ORDER.indexOf(kind as PermissionGroupKind);
  return index < 0 ? GROUP_KIND_ORDER.length : index;
};

/**
 * 左侧组列表：按身份、部门、称号、自定义分段。身份按权重从低到高（访客在前），部门按 sort，
 * 称号先站长、再按部门顺序、部门内权重从高到低（部长在前），自定义按名称。
 */
export function groupSections(groups: PermissionGroup[]): { kind: PermissionGroupKind; label: string; items: PermissionGroup[] }[] {
  const departmentOrder = new Map(groups.filter(g => g.kind === "department").map(g => [g.id, g.sort]));
  const deptRank = (id: string | null) => (id === null ? -1 : departmentOrder.get(id) ?? Number.MAX_SAFE_INTEGER);
  const compare = (a: PermissionGroup, b: PermissionGroup): number => {
    if (a.kind === "level") return a.weight - b.weight || a.sort - b.sort;
    if (a.kind === "department") return a.sort - b.sort || a.name.localeCompare(b.name, "zh-CN");
    if (a.kind === "title") return deptRank(a.department_id) - deptRank(b.department_id) || b.weight - a.weight;
    return a.name.localeCompare(b.name, "zh-CN") || a.id.localeCompare(b.id);
  };
  const byKind = new Map<PermissionGroupKind, PermissionGroup[]>();
  for (const group of groups) {
    const kind = (GROUP_KIND_ORDER as string[]).includes(group.kind) ? group.kind : "custom";
    byKind.set(kind, [...(byKind.get(kind) ?? []), group]);
  }
  return [...byKind.entries()]
    .sort(([a], [b]) => kindIndex(a) - kindIndex(b))
    .map(([kind, items]) => ({ kind, label: GROUP_KIND_TEXT[kind], items: [...items].sort(compare) }));
}

/** 组在列表和来源链里的名字：部门里的称号写成「AI部门 · 部长」，不然几个「部长」分不清。 */
export function groupLabel(group: Pick<PermissionGroup, "kind" | "name" | "department_id">, groups: Pick<PermissionGroup, "id" | "name">[]): string {
  if (group.kind !== "title" || !group.department_id) return group.name;
  const department = groups.find(item => item.id === group.department_id);
  return department ? `${department.name} · ${group.name}` : group.name;
}

/** 条目里的节点：通配写成「全部权限」「users 下的全部节点」，具体节点用中文名。 */
export function entryNodeLabel(node: string, labelOf: (node: string) => string): string {
  if (node === "*") return "全部权限";
  if (node.endsWith(".*")) return `${node.slice(0, -2)} 下的全部节点`;
  return labelOf(node);
}

/** meta 取值：-1 是不限。 */
export const metaValueText = (value: string): string => (value.trim() === "-1" ? "不限" : value);

/** 条目的结果：允许、拒绝，或者 meta 的取值。 */
export function entryValueText(entry: Pick<PermissionEntry, "value" | "meta_value">): { text: string; status: "success" | "danger" | "info" } {
  if (entry.meta_value !== null) return { text: `取值 ${metaValueText(entry.meta_value)}`, status: "info" };
  return entry.value ? { text: "允许", status: "success" } : { text: "拒绝", status: "danger" };
}

const SCOPE_KEY_TEXT: Record<string, string> = { department: "部门", category: "论坛分类", competition: "比赛" };
/** 范围：空对象是不限范围；每个键写成「部门：AI部门」，值是数组时用顿号连起来。`nameOf` 把部门等编号换成名字。 */
export function scopeText(scope: Record<string, unknown> | null | undefined, nameOf: (id: string) => string = id => id): string {
  const entries = Object.entries(scope ?? {});
  if (!entries.length) return "不限范围";
  return entries.map(([key, value]) => {
    const values = (Array.isArray(value) ? value : [value]).map(item => nameOf(String(item)));
    return `${SCOPE_KEY_TEXT[key] ?? key}：${values.join("、")}`;
  }).join("；");
}

/** 过期了的条目和成员资格读取时就不算数（SPEC §3.5），页面上照样列出来但标「已过期」。 */
export const isExpired = (at: number | null, now = Date.now()): boolean => at !== null && at <= now;

/** 添加条目的表单：结果在允许、拒绝之间选；meta 节点改填取值。范围是 JSON，到期是北京时间的日期。 */
export type EntryDraft = { node: string; value: "allow" | "deny"; metaValue: string; scope: string; expiresDate: string };
export const emptyEntryDraft = (): EntryDraft => ({ node: "", value: "allow", metaValue: "", scope: "", expiresDate: "" });

/** 节点目录里有的才算；通配 `*` 与 `前缀.*` 只要前缀在目录里出现过就算（服务端还会再核对）。 */
export function knownNode(node: string, nodes: Pick<PermissionNodeDef, "node">[]): boolean {
  if (node === "*") return true;
  if (node.endsWith(".*")) return nodes.some(item => item.node.startsWith(node.slice(0, -1)));
  return nodes.some(item => item.node === node);
}

/** meta 节点填取值，不填允许或拒绝；以节点目录的 meta 标记为准，通配不算。 */
export const isMetaNode = (node: string, nodes: Pick<PermissionNodeDef, "node" | "meta">[]): boolean =>
  !node.endsWith("*") && (nodes.find(item => item.node === node)?.meta ?? node.startsWith("meta."));

/** 条目表单 → PATCH 里的 entries.add 一项；从上到下报第一处问题。 */
export function entryInput(draft: EntryDraft, nodes: PermissionNodeDef[], now = Date.now()): { input: PermissionEntryInput } | { error: string } {
  const node = draft.node.trim();
  if (!node) return { error: "选一个节点" };
  if (!/^(\*|[a-z][a-z0-9_]*(\.[a-z0-9_]+)*(\.\*)?)$/.test(node) || !knownNode(node, nodes)) return { error: "节点目录里没有这个节点" };
  const input: PermissionEntryInput = { node };
  const meta = isMetaNode(node, nodes);
  if (meta) {
    const value = draft.metaValue.trim();
    if (!/^(-1|\d+)$/.test(value)) return { error: "取值填一个不小于 0 的整数，不限填 -1" };
    input.meta_value = value;
  } else {
    input.value = draft.value === "allow";
  }
  const scopeRaw = draft.scope.trim();
  if (scopeRaw) {
    let scope: unknown;
    try { scope = JSON.parse(scopeRaw); } catch { return { error: "范围要写成 JSON，例如 {\"department\":[\"dept.ai\"]}" }; }
    if (!scope || typeof scope !== "object" || Array.isArray(scope)) return { error: "范围要写成 JSON 对象，例如 {\"department\":[\"dept.ai\"]}" };
    input.scope = scope as Record<string, unknown>;
  }
  if (draft.expiresDate.trim()) {
    const expiresAt = dateEdge(draft.expiresDate, "end");
    if (expiresAt === null) return { error: "到期日期不是有效的日期" };
    if (expiresAt <= now) return { error: "到期日期要在今天或以后" };
    input.expires_at = expiresAt;
  }
  return { input };
}

/** 新建自定义组：编号是 custom.<小写字母、数字、下划线>，名称 1–32 字，权重 0–1000 的整数。 */
export type GroupDraft = { slug: string; name: string; description: string; weight: number | null; parents: string[] };
export const emptyGroupDraft = (): GroupDraft => ({ slug: "", name: "", description: "", weight: 10, parents: [] });

function weightProblem(weight: number | null): string | null {
  return weight === null || !Number.isInteger(weight) || weight < 0 || weight > 1000 ? "权重填 0–1000 的整数" : null;
}
function nameProblem(name: string): string | null {
  const length = [...name.trim()].length;
  return length < 1 || length > 32 ? "名称填 1–32 个字" : null;
}

export function createGroupInput(draft: GroupDraft, existing: Pick<PermissionGroup, "id">[]): { payload: PermissionGroupCreate } | { error: string } {
  const slug = draft.slug.trim().replace(/^custom\./, "");
  if (!/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(slug) || slug.length > 40) return { error: "编号只用小写字母、数字和下划线，最多 40 个字符" };
  const id = `custom.${slug}`;
  if (existing.some(group => group.id === id)) return { error: `已经有 ${id} 这个组` };
  const problem = nameProblem(draft.name) ?? weightProblem(draft.weight);
  if (problem) return { error: problem };
  const payload: PermissionGroupCreate = { id, name: draft.name.trim(), weight: draft.weight as number };
  if (draft.description.trim()) payload.description = draft.description.trim();
  if (draft.parents.length) payload.parents = [...draft.parents];
  return { payload };
}

/** 组的基本信息：名称、说明、权重、继承。只带改了的字段，没改回 null。 */
export type GroupForm = { name: string; description: string; weight: number | null; parents: string[] };
export const groupForm = (group: PermissionGroup): GroupForm => ({ name: group.name, description: group.description, weight: group.weight, parents: [...group.parents] });

export function groupPatch(group: PermissionGroup, form: GroupForm): { patch: PermissionGroupPatch | null } | { error: string } {
  const problem = nameProblem(form.name) ?? weightProblem(form.weight);
  if (problem) return { error: problem };
  if (form.parents.includes(group.id)) return { error: "组不能继承自己" };
  const patch: PermissionGroupPatch = {};
  if (form.name.trim() !== group.name) patch.name = form.name.trim();
  if (form.description.trim() !== group.description) patch.description = form.description.trim();
  if (form.weight !== group.weight) patch.weight = form.weight as number;
  const before = [...group.parents].sort().join(",");
  if ([...form.parents].sort().join(",") !== before) patch.parents = [...form.parents];
  return { patch: Object.keys(patch).length ? patch : null };
}

/** 解释结果的说法：unset 按拒绝处理（SPEC §3.5）。 */
export const EXPLAIN_TEXT: Record<"allow" | "deny" | "unset", { text: string; status: "success" | "danger" | "muted"; detail: string }> = {
  allow: { text: "允许", status: "success", detail: "命中的条目里有允许、没有拒绝。" },
  deny: { text: "拒绝", status: "danger", detail: "命中的条目里有拒绝，拒绝优先。" },
  unset: { text: "没有设置", status: "muted", detail: "没有任何条目命中这个节点，按拒绝处理。" },
};

/** 一条命中从哪来：账号自己的条目，或者「极客班成员 → 注册用户」这样的继承链（最后一个是条目所在的组）。 */
export function hitSourceText(hit: Pick<PermissionExplainHit, "source" | "group" | "via">, nameOf: (id: string) => string): string {
  if (hit.source === "account") return "账号自己的条目";
  const chain = hit.via.length ? hit.via : hit.group ? [hit.group.id] : [];
  const names = chain.map(nameOf);
  if (hit.group && chain[chain.length - 1] !== hit.group.id) names.push(hit.group.name);
  return names.join(" → ") || "未知的组";
}

/** 一串节点按业务域分组，域的顺序照 SPEC §3.3 的表；表里没有的域排在最后。 */
export function nodesByDomain(
  nodes: string[], domainOf: (node: string) => string = nodeDomain, domains: { id: string; label: string }[] = PERMISSION_DOMAINS,
): { id: string; label: string; nodes: string[] }[] {
  const order = domains.map(item => item.id);
  const byDomain = new Map<string, string[]>();
  for (const node of [...nodes].sort()) byDomain.set(domainOf(node), [...(byDomain.get(domainOf(node)) ?? []), node]);
  const rank = (id: string) => (order.includes(id) ? order.indexOf(id) : order.length);
  return [...byDomain.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([id, list]) => ({ id, label: domains.find(item => item.id === id)?.label ?? id, nodes: list }));
}

/** 节点目录里出现过的全部通配：`*` 和每一级前缀的 `前缀.*`（例如 forum.* 与 forum.moderate.*）。 */
export function wildcardNodes(nodes: Pick<PermissionNodeDef, "node">[]): string[] {
  const prefixes = new Set<string>();
  for (const { node } of nodes) {
    const parts = node.split(".");
    for (let i = 1; i < parts.length; i += 1) prefixes.add(`${parts.slice(0, i).join(".")}.*`);
  }
  return ["*", ...[...prefixes].sort()];
}

/**
 * 「添加条目」的节点选项：先是通配，再按业务域分组。TxSelect 0.6.0 只按 label 搜索，
 * 所以 label 里同时放中文名和节点本身。
 */
export function nodeSelectGroups(
  nodes: PermissionNodeDef[], domains: { id: string; label: string }[],
): { label: string; options: { value: string; label: string }[] }[] {
  const byDomain = nodesByDomain(nodes.map(item => item.node), node => nodes.find(item => item.node === node)?.domain ?? nodeDomain(node), domains);
  const labelOf = (node: string) => nodes.find(item => item.node === node)?.label ?? node;
  return [
    { label: "通配", options: wildcardNodes(nodes).map(node => ({ value: node, label: `${entryNodeLabel(node, labelOf)} ${node}` })) },
    ...byDomain.map(domain => ({ label: domain.label, options: domain.nodes.map(node => ({ value: node, label: `${labelOf(node)} ${node}` })) })),
  ];
}
