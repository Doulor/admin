// 招聘邮件模板页（#285、#293）的纯逻辑：草稿与接口内容互转、正文文字与块互转、变量插入、服务端指出的问题标到输入框、
// 实时预览的节流与过期响应丢弃、试发的结果说法、状态与模板的对应。不导入 Vue，tests/console/mail-templates.test.ts 直接测。
// 字段名、长度上限和错误码与服务端 lib/mail/template-content.ts、routes/console/mail-templates.ts 一致。
import { ApiError } from "./http";
import type {
  MailBlock, MailFact, MailKind, MailRendered, MailTemplate, MailTemplateContent, MailTemplateIssue, MailTestSend, MailVariable,
} from "./types";

// ---- 草稿 ----

export type TemplateDraft = {
  /** null 是还没保存的新模板 */
  id: string | null;
  name: string;
  kind: MailKind;
  subject: string;
  preheader: string;
  kicker: string;
  greeting: string;
  /** 正文是一份类 Markdown 的文字：空一行是新的一段，要点列表、信息表、引用写成「:::」围起来的一段，写法见 blocksToText */
  body: string;
  buttonOn: boolean;
  buttonLabel: string;
  buttonPath: string;
  /** 页脚在表单里是一个多行输入框，一行一条 */
  footer: string;
};

const lines = (value: string): string[] => value.split(/\r\n?|\n/).map(line => line.trim()).filter(Boolean);

// ---- 正文：块与文字互转 ----

/**
 * 正文里要点列表、信息表、引用的写法：
 *   :::要点 标题（标题可不写）      :::信息 标题（可不写）      :::引用 标题
 *   一行一条                        名称：内容                  引用的话
 *   :::                             :::                         :::
 * 其余的文字按空行分段，一段就是一个段落块。以「:::」开头的普通文字写成「\:::」。
 * 文字与块一一对应，接口和已存的模板格式不变；转换只发生在这个页面里。
 */
const FENCE = ":::";
const FENCE_KIND: Record<string, "list" | "facts" | "quote"> = { 要点: "list", 要点列表: "list", 列表: "list", 信息: "facts", 信息表: "facts", 引用: "quote" };
const FENCE_NAME = { list: "要点", facts: "信息", quote: "引用" } as const;
export type FenceKind = keyof typeof FENCE_NAME;

const escapeLine = (line: string): string => (line.trimStart().startsWith(FENCE) ? `\\${line.trimStart()}` : line);
const unescapeLine = (line: string): string => (line.trimStart().startsWith(`\\${FENCE}`) ? line.trimStart().slice(1) : line);

/** 块 → 正文文字 */
export function blocksToText(blocks: readonly MailBlock[]): string {
  const open = (kind: FenceKind, title: string | undefined) => `${FENCE}${FENCE_NAME[kind]}${title ? ` ${title}` : ""}`;
  return blocks.map(block => {
    if (block.kind === "paragraph") return block.text.split("\n").map(escapeLine).join("\n");
    if (block.kind === "list") return [open("list", block.title), ...block.items.map(escapeLine), FENCE].join("\n");
    if (block.kind === "facts") return [open("facts", block.title), ...block.items.map(item => `${item.label}：${item.value}`), FENCE].join("\n");
    return [open("quote", block.title), ...block.text.split("\n").map(escapeLine), FENCE].join("\n");
  }).join("\n\n");
}

const splitFact = (line: string): MailFact => {
  const at = line.search(/[：:]/);
  return at < 0 ? { label: line, value: "" } : { label: line.slice(0, at).trim(), value: line.slice(at + 1).trim() };
};

function fenced(kind: FenceKind, title: string, inner: string[]): MailBlock {
  const head = title ? { title } : {};
  if (kind === "list") return { kind, ...head, items: lines(inner.join("\n")) };
  if (kind === "facts") return { kind, ...head, items: lines(inner.join("\n")).map(splitFact) };
  return { kind: "quote", title, text: inner.join("\n").trim() };
}

/** 正文文字 → 块。写得不全的（没有结尾的「:::」、没有内容的块）照样转成块，由服务端指出缺什么。 */
export function textToBlocks(text: string): MailBlock[] {
  const blocks: MailBlock[] = [];
  const rows = text.split(/\r\n?|\n/);
  let paragraph: string[] = [];
  const flush = () => {
    const joined = paragraph.join("\n").trim();
    if (joined) blocks.push({ kind: "paragraph", text: joined });
    paragraph = [];
  };
  for (let i = 0; i < rows.length; i += 1) {
    const open = /^\s*:::\s*([^\s:]+)?\s*(.*?)\s*$/.exec(rows[i]);
    const kind = open ? FENCE_KIND[open[1] ?? ""] : undefined;
    if (!open || !kind) {
      if (rows[i].trim() === "") flush();
      else paragraph.push(unescapeLine(rows[i]));
      continue;
    }
    flush();
    const inner: string[] = [];
    while (i + 1 < rows.length && rows[i + 1].trim() !== FENCE) {
      i += 1;
      inner.push(unescapeLine(rows[i]));
    }
    i += 1;
    blocks.push(fenced(kind, open[2], inner));
  }
  flush();
  return blocks;
}

/** 在光标处插入一段要点列表、信息表或引用的写法，前后各空一行；返回新值和第一行内容的起点。 */
export function insertFence(value: string, caret: Caret | null, kind: FenceKind): { value: string; caret: number } {
  const sample = { list: "第一条\n第二条", facts: "名称：内容\n名称：内容", quote: "引用的话" }[kind];
  const title = kind === "quote" ? " 标题" : "";
  const head = `${FENCE}${FENCE_NAME[kind]}${title}`;
  const start = caret ? Math.min(Math.max(0, Math.min(caret.start, caret.end)), value.length) : value.length;
  const end = caret ? Math.min(Math.max(caret.start, caret.end, start), value.length) : value.length;
  const before = value.slice(0, start);
  const after = value.slice(end);
  const lead = !before ? "" : before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  const tail = !after ? "\n" : after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";
  const piece = `${head}\n${sample}\n${FENCE}`;
  return { value: `${before}${lead}${piece}${tail}${after}`, caret: before.length + lead.length + head.length + 1 };
}

// ---- 草稿与请求内容互转 ----

function fromContent(id: string | null, name: string, kind: MailKind, content: MailTemplateContent): TemplateDraft {
  return {
    id, name, kind,
    subject: content.subject, preheader: content.preheader, kicker: content.kicker, greeting: content.greeting,
    body: blocksToText(content.blocks),
    buttonOn: content.button !== null, buttonLabel: content.button?.label ?? "", buttonPath: content.button?.path ?? "",
    footer: content.footer.join("\n"),
  };
}

export const draftFromTemplate = (template: MailTemplate): TemplateDraft => fromContent(template.id, template.name, template.kind, template);

/** 新模板或复制出来的草稿：内容取自 base（通常是这一类的默认模板），没有 base 时正文是空的。 */
export function newDraft(kind: MailKind, base: MailTemplateContent | null, name = ""): TemplateDraft {
  const content: MailTemplateContent = base ?? { subject: "", preheader: "", kicker: "", greeting: "{{称呼}}", blocks: [], button: null, footer: [] };
  return fromContent(null, name, kind, content);
}

/** 草稿 → 请求里的内容。没写的标题不带，按钮没打开就是 null。 */
export function draftContent(draft: TemplateDraft): MailTemplateContent {
  return {
    subject: draft.subject, preheader: draft.preheader, kicker: draft.kicker, greeting: draft.greeting,
    blocks: textToBlocks(draft.body),
    button: draft.buttonOn ? { label: draft.buttonLabel, path: draft.buttonPath.trim() } : null,
    footer: lines(draft.footer),
  };
}

/** 新建的请求体；kind 建好以后不能改，所以编辑时的请求体里没有它。 */
export const createBody = (draft: TemplateDraft) => ({ name: draft.name, kind: draft.kind, ...draftContent(draft) });
/** 编辑的请求体：整套内容加上读到它时的更新时间，别人改过服务端回 409。 */
export const updateBody = (draft: TemplateDraft, expectedUpdatedAt: number) => ({ name: draft.name, ...draftContent(draft), expected_updated_at: expectedUpdatedAt });

/** 草稿的快照，用来判断有没有没保存的修改。 */
export const draftSnapshot = (draft: TemplateDraft): string => JSON.stringify({ id: draft.id, name: draft.name, kind: draft.kind, ...draftContent(draft) });

/** 复制出来的名字不能和同一类里已有的重名（服务端不分大小写），也不超过名字的长度上限。 */
export function copyName(name: string, existing: readonly string[], max: number): string {
  const taken = new Set(existing.map(item => item.toLowerCase()));
  for (let n = 1; ; n += 1) {
    const suffix = n === 1 ? "（副本）" : `（副本 ${n}）`;
    const candidate = `${[...name].slice(0, Math.max(1, max - [...suffix].length)).join("")}${suffix}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

// ---- 输入框的位置、变量 ----

/** 输入框的编号：和服务端指出问题时用的路径写法一样（subject、button.label），正文是 body，页脚是 footer。 */
const TOP_FIELDS = ["name", "subject", "preheader", "kicker", "greeting", "body", "footer"] as const;

/** 编号对应的草稿里的值；不认识的编号返回 null。 */
export function fieldValue(draft: TemplateDraft, field: string): string | null {
  const target = locate(draft, field);
  return target ? target.get() : null;
}

/** 改编号对应的值；不认识的编号返回 false。 */
export function setFieldValue(draft: TemplateDraft, field: string, value: string): boolean {
  const target = locate(draft, field);
  if (!target) return false;
  target.set(value);
  return true;
}

type Access = { get: () => string; set: (value: string) => void };

function locate(draft: TemplateDraft, field: string): Access | null {
  if ((TOP_FIELDS as readonly string[]).includes(field)) {
    const key = field as (typeof TOP_FIELDS)[number];
    return { get: () => draft[key], set: value => { draft[key] = value; } };
  }
  if (field === "button.label") return { get: () => draft.buttonLabel, set: value => { draft.buttonLabel = value; } };
  if (field === "button.path") return { get: () => draft.buttonPath, set: value => { draft.buttonPath = value; } };
  return null;
}

export const variableToken = (name: string): string => `{{${name}}}`;

export type Caret = { start: number; end: number };

/** 在光标处插入文字；选中了一段就替换它；不知道光标位置时接在最后。返回新值和插入后的光标位置。 */
export function insertAtCaret(value: string, caret: Caret | null, token: string): { value: string; caret: number } {
  const start = caret ? Math.min(Math.max(0, Math.min(caret.start, caret.end)), value.length) : value.length;
  const end = caret ? Math.min(Math.max(caret.start, caret.end, start), value.length) : value.length;
  return { value: `${value.slice(0, start)}${token}${value.slice(end)}`, caret: start + token.length };
}

/** 往编号对应的输入框里插入变量；成功返回新的光标位置，编号不认识返回 null。 */
export function insertVariable(draft: TemplateDraft, target: { field: string; caret: Caret | null }, name: string): number | null {
  const current = fieldValue(draft, target.field);
  if (current === null) return null;
  const next = insertAtCaret(current, target.caret, variableToken(name));
  setFieldValue(draft, target.field, next.value);
  return next.caret;
}

export type VariableGroup = { label: string; variables: MailVariable[] };

/** 这一类信能用的变量，按服务端清单的顺序分组；用在别的类别里保存会被拒绝，所以清单里不列。 */
export function variablesFor(kind: MailKind, variables: readonly MailVariable[]): VariableGroup[] {
  const groups: VariableGroup[] = [];
  for (const variable of variables) {
    if (!variable.kinds.includes(kind)) continue;
    const group = groups.find(item => item.label === variable.group_label);
    if (group) group.variables.push(variable);
    else groups.push({ label: variable.group_label, variables: [variable] });
  }
  return groups;
}

// ---- 服务端指出的问题 ----

export type FieldIssues = { byField: Record<string, string[]>; general: string[] };

/**
 * 把服务端指出的问题标到输入框上。同一个输入框的几条都留着；正文里任何一块的问题都标在正文输入框上（服务端的话里已经写了第几块），
 * 页脚第几行出问题标在整个页脚输入框上。保存和预览指出的同一句话只留一条。认不出对应输入框的（整份模板的问题）放进 general，由页面单独写出来。
 */
export function placeIssues(issues: readonly MailTemplateIssue[]): FieldIssues {
  const byField: Record<string, string[]> = {};
  const general: string[] = [];
  const add = (field: string, message: string) => {
    const messages = (byField[field] ??= []);
    if (!messages.includes(message)) messages.push(message);
  };
  for (const issue of issues) {
    const path = issue.path;
    if (path === "blocks" || /^blocks\[\d+\]/.test(path)) add("body", issue.message);
    else if (/^footer\[\d+\]$/.test(path)) add("footer", issue.message);
    else if (path === "button" || path === "button.label" || path === "button.path" || (TOP_FIELDS as readonly string[]).includes(path)) add(path, issue.message);
    else if (!general.includes(issue.message)) general.push(issue.message);
  }
  return { byField, general };
}

export const issueCount = (placed: FieldIssues): number => Object.values(placed.byField).reduce((sum, messages) => sum + messages.length, 0) + placed.general.length;

/** 接口错误里带的 issues 数组；不是这个形状的返回空数组。 */
export function issuesOf(error: unknown): MailTemplateIssue[] {
  if (!(error instanceof ApiError)) return [];
  const issues = error.payload?.issues;
  if (!Array.isArray(issues)) return [];
  return issues.flatMap(item => {
    const path = (item as { path?: unknown } | null)?.path;
    const message = (item as { message?: unknown } | null)?.message;
    return typeof path === "string" && typeof message === "string" ? [{ path, message }] : [];
  });
}

// ---- 实时预览 ----

export type PreviewSample = { name?: string; class_name?: string; strengths?: string };
export type PreviewLetter = { time?: string; place?: string; notes?: string; message?: string };
export type PreviewPayload = { draft: MailTemplateContent & { kind: MailKind }; sample?: PreviewSample; letter?: PreviewLetter };

/** 预览用的数据：空着的项不带，服务端用它自己的示例。 */
export function previewPayload(draft: TemplateDraft, sample: PreviewSample = {}, letter: PreviewLetter = {}): PreviewPayload {
  const keep = <T extends Record<string, string | undefined>>(value: T): Partial<T> =>
    Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item.trim() !== "")) as Partial<T>;
  const payload: PreviewPayload = { draft: { kind: draft.kind, ...draftContent(draft) } };
  const sampleBody = keep(sample);
  const letterBody = keep(letter);
  if (Object.keys(sampleBody).length) payload.sample = sampleBody;
  if (Object.keys(letterBody).length) payload.letter = letterBody;
  return payload;
}

export type PreviewState = {
  phase: "idle" | "loading" | "ready" | "error";
  /** 最近一次渲染成功的结果：这一版渲染不出来时还留着，页面把它标成旧的，不让预览整块闪空 */
  rendered: MailRendered | null;
  message: string;
  issues: MailTemplateIssue[];
};
export const IDLE_PREVIEW: PreviewState = { phase: "idle", rendered: null, message: "", issues: [] };

/** 预览失败时给人看的一句话和服务端指出的问题。 */
export function previewFailure(error: unknown): { message: string; issues: MailTemplateIssue[] } {
  if (error instanceof ApiError) {
    const issues = issuesOf(error);
    if (error.code === "template_invalid" && issues.length > 1) return { message: `${issues[0].message}（另有 ${issues.length - 1} 处，已标在对应的输入框下面）`, issues };
    return { message: error.message || "预览失败", issues };
  }
  return { message: "连不上服务器，预览没有更新", issues: [] };
}

export type Timers = { set: (run: () => void, ms: number) => unknown; clear: (handle: unknown) => void };
const BROWSER_TIMERS: Timers = { set: (run, ms) => setTimeout(run, ms), clear: handle => clearTimeout(handle as ReturnType<typeof setTimeout>) };

/** 编辑停下多久以后才去请求预览 */
export const PREVIEW_DELAY_MS = 400;

/**
 * 实时预览：request 收到最新的内容，停手 delay 毫秒后才请求一次；连着改只发最后一份。
 * 请求在路上时又来了新的内容，先回来的旧结果丢掉，只认最新的那次。内容和上一次请求的一样就不再请求。
 */
export function createPreviewer(options: {
  run: (payload: PreviewPayload) => Promise<MailRendered>;
  onState: (state: PreviewState) => void;
  delay?: number;
  timers?: Timers;
}) {
  const delay = options.delay ?? PREVIEW_DELAY_MS;
  const timers = options.timers ?? BROWSER_TIMERS;
  let state: PreviewState = IDLE_PREVIEW;
  let timer: unknown = null;
  let seq = 0;
  let lastKey = "";
  let pending: PreviewPayload | null = null;
  const publish = (next: PreviewState) => { state = next; options.onState(next); };

  async function execute(payload: PreviewPayload) {
    const mine = ++seq;
    publish({ ...state, phase: "loading", message: "", issues: [] });
    try {
      const rendered = await options.run(payload);
      if (mine === seq) publish({ phase: "ready", rendered, message: "", issues: [] });
    } catch (error) {
      if (mine !== seq) return;
      const failure = previewFailure(error);
      publish({ phase: "error", rendered: state.rendered, message: failure.message, issues: failure.issues });
    }
  }

  function clearTimer() {
    if (timer !== null) timers.clear(timer);
    timer = null;
  }

  return {
    request(payload: PreviewPayload) {
      const key = JSON.stringify(payload);
      if (key === lastKey) return;
      lastKey = key;
      pending = payload;
      clearTimer();
      timer = timers.set(() => { timer = null; void execute(payload); }, delay);
    },
    /** 不等停手，马上按最新的内容请求一次（换了一套模板、点「刷新预览」时） */
    flush(payload?: PreviewPayload) {
      clearTimer();
      const next = payload ?? pending;
      if (!next) return;
      lastKey = JSON.stringify(next);
      pending = next;
      void execute(next);
    },
    /** 放弃排着的和在路上的请求，回到什么都没渲染的状态（换了一套模板、离开页面时） */
    reset() {
      clearTimer();
      seq += 1;
      lastKey = "";
      pending = null;
      publish(IDLE_PREVIEW);
    },
  };
}

// ---- 试发 ----

const MAILBOX = /^[^\s@<>()[\],;:"\\]+@[^\s@<>()[\],;:"\\]+\.[^\s@<>()[\],;:"\\]+$/;

/** 发请求之前在本地先看一眼；服务端还会再核对（invalid_address）。 */
export function testAddressError(value: string): string | null {
  const address = value.trim();
  if (!address) return "请填一个测试邮箱。";
  if (address.length > 320 || !MAILBOX.test(address)) return "测试邮箱要是一个普通的邮箱地址，例如 name@example.com。";
  return null;
}

export type TestOutcome = { text: string; tone: "success" | "warning" | "danger" | "muted" };

/** 试发的结果，照实说：发出了、排队中、没发（为什么）、发失败了（对方的错误码）。to 是服务端脱敏后的地址。 */
export function testSendOutcome(result: MailTestSend): TestOutcome {
  switch (result.status) {
    case "sent":
      return { text: `已发出，请到 ${result.to} 查收。`, tone: "success" };
    case "pending":
      return { text: `已交给发信队列，稍后到 ${result.to} 查收。`, tone: "muted" };
    case "skipped":
      if (result.skip_reason === "mail_disabled") return { text: "发信还没有配置，这封没有发出。", tone: "warning" };
      if (result.skip_reason === "not_allowlisted") return { text: "当前只给白名单里的邮箱发信，这个地址不在其中，这封没有发出。", tone: "warning" };
      return { text: `这封没有发出${result.skip_reason ? `（${result.skip_reason}）` : ""}。`, tone: "warning" };
    default:
      return { text: `没有发出：${result.error || "原因不明"}`, tone: "danger" };
  }
}

/** 试发请求本身被拒绝时的话：地址不对、模板有问题、次数用完。其余的错误（没登录、没权限、要重新登录）返回 null，交给 ErrorAlert。 */
export function testSendFailure(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  if (error.status === 429 && error.code === "rate_limited") {
    const wait = typeof error.payload?.retry_after === "number" ? Math.ceil(error.payload.retry_after / 60) : 0;
    return `${error.message}${wait > 0 ? `（约 ${wait} 分钟后恢复）` : ""}`;
  }
  if (error.status === 400 && error.code === "invalid_address") return error.message;
  if (error.status === 400 && (error.code === "template_invalid" || error.code === "preview_failed")) return `这套模板现在还发不出去：${error.message}`;
  return null;
}

// ---- 模板列表 ----

export type KindGroup = { kind: MailKind; label: string; templates: MailTemplate[] };

/** 按信的类别分组，类别和组内的顺序都沿用服务端给的。 */
export function groupByKind(templates: readonly MailTemplate[], kinds: readonly { id: MailKind; label: string }[]): KindGroup[] {
  return kinds.map(({ id, label }) => ({ kind: id, label, templates: templates.filter(template => template.kind === id) }));
}

/** 一行模板旁边的标记 */
export function templateFlags(template: Pick<MailTemplate, "is_default" | "enabled">): string[] {
  return [...(template.is_default ? ["默认"] : []), ...(template.enabled ? [] : ["已停用"])];
}

export type StatusRoute = { kind: MailKind; label: string; choices: MailTemplate[]; current: MailTemplate | null; total: number };

/** 「状态与模板」一行：每个状态能选的（已启用的）模板，和现在发信用的那一套（这一类的默认）。 */
export function statusRoutes(groups: readonly KindGroup[]): StatusRoute[] {
  return groups.map(group => ({
    kind: group.kind, label: group.label, total: group.templates.length,
    choices: group.templates.filter(template => template.enabled),
    current: group.templates.find(template => template.is_default) ?? null,
  }));
}
