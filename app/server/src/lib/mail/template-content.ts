import { oneLine, safeMailLink, type EnvelopeBlock, type EnvelopeMessage } from "./envelope.js";

/**
 * 招聘信模板的内容（#285）：一封信的主题、摘要、小字、抬头、正文块、按钮、页脚，全是数据。
 * 内置默认（recruitment.ts 在没有库模板时用）和首次迁移的种子（migrations/2026-10-mail-templates.ts）读的是同一份
 * DEFAULT_TEMPLATES，不另抄一份。
 *
 * 变量是固定清单（TEMPLATE_VARIABLES），写成 {{变量名}}，只做替换：替换出来的值原样放进 EnvelopeMessage 的文字字段，
 * 转义、控制字符、链接白名单都由 renderEnvelope 统一处理，这里不写表达式、不递归替换（值里再出现 {{…}} 也只是普通文字）。
 * 版式不开放：模板只能选正文块的类型和顺序、要不要按钮和页脚，所有渲染走 renderEnvelope。
 */

/** 招聘信的四个类别，对应投递状态 received / interview / accepted / rejected。 */
export type RecruitmentKind = "received" | "interview" | "accepted" | "rejected";
export const RECRUITMENT_KINDS: readonly RecruitmentKind[] = ["received", "interview", "accepted", "rejected"];
export const isRecruitmentKind = (value: unknown): value is RecruitmentKind => typeof value === "string" && (RECRUITMENT_KINDS as readonly string[]).includes(value);

export type TemplateFact = { label: string; value: string };
export type TemplateBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "list"; title?: string; items: string[] }
  | { kind: "facts"; title?: string; items: TemplateFact[] }
  | { kind: "quote"; title: string; text: string };
export type TemplateBlockKind = TemplateBlock["kind"];
export const TEMPLATE_BLOCK_KINDS: readonly TemplateBlockKind[] = ["paragraph", "list", "facts", "quote"];

/** 按钮的链接只写站内路径，拼上站点地址后还要过 safeMailLink（只放行 yangtzeu.work / prev.yangtzeu.work）。 */
export type TemplateButton = { label: string; path: string };

export type TemplateContent = {
  subject: string;
  /** 收件箱列表里主题后面露出的一行 */
  preheader: string;
  /** 信纸左上角的小字 */
  kicker: string;
  /** 抬头，通常是 {{称呼}} */
  greeting: string;
  blocks: TemplateBlock[];
  button: TemplateButton | null;
  /** 信纸下面的小字，一行一条 */
  footer: string[];
};

export const TEMPLATE_LIMITS = {
  name: 40, subject: 100, preheader: 200, kicker: 60, greeting: 120,
  blocks: 20, paragraph: 2000, title: 60, listItems: 20, listItem: 500, factItems: 12, factLabel: 30, factValue: 500, quote: 2000,
  footerLines: 4, footerLine: 200, buttonLabel: 30, buttonPath: 200,
  /** 所有文字加起来的上限：Gmail 超过 102KB 的信会被截断，6000 字的模板加上投递人写的内容仍在 40KB 以内 */
  totalText: 6000,
} as const;

export type VariableGroup = "applicant" | "letter" | "sentence";
export const VARIABLE_GROUP_LABELS: Record<VariableGroup, string> = { applicant: "投递人", letter: "改状态时填的", sentence: "整句" };

export type TemplateVariable = {
  name: string;
  group: VariableGroup;
  description: string;
  /** 哪几类信里有这个值；用在别的类别里保存时会被拒绝 */
  kinds: readonly RecruitmentKind[];
  /** 多行的值：整条列表项只写它时，每一行展开成一条 */
  multiline: boolean;
};

const ALL = RECRUITMENT_KINDS;
/**
 * 变量清单，写在这一处，接口原样返回给前端。applications 表没有部门或投递方向这一列，所以没有 {{部门}}。
 * 「整句」是随情况变化的固定句子：有没有回信地址、有没有填说明，写法不一样，整句写好，后面自己补句号。
 */
export const TEMPLATE_VARIABLES: readonly TemplateVariable[] = [
  { name: "称呼", group: "applicant", description: "抬头用的称呼，按姓写，例如「张同学，你好：」", kinds: ALL, multiline: false },
  { name: "姓名", group: "applicant", description: "投递人填的姓名", kinds: ALL, multiline: false },
  { name: "班级", group: "applicant", description: "投递人填的班级", kinds: ALL, multiline: false },
  { name: "邮箱", group: "applicant", description: "投递人填的邮箱，也是收信地址", kinds: ALL, multiline: false },
  { name: "投递时间", group: "applicant", description: "投递时间，写明是北京时间", kinds: ALL, multiline: false },
  { name: "报名编号", group: "applicant", description: "这份投递的编号", kinds: ALL, multiline: false },
  { name: "特长", group: "applicant", description: "投递人写的特长与优点，可能有好几行", kinds: ALL, multiline: true },
  { name: "官网", group: "applicant", description: "官网首页的地址", kinds: ALL, multiline: false },
  { name: "面试时间", group: "letter", description: "改成待面试时填的面试时间", kinds: ["interview"], multiline: false },
  { name: "面试地点", group: "letter", description: "改成待面试时填的面试地点", kinds: ["interview"], multiline: false },
  { name: "说明", group: "letter", description: "改状态时填的内容，一行一条：待面试是面试说明，已录取是接下来要做的事，未通过是写给投递人的话", kinds: ["interview", "accepted", "rejected"], multiline: true },
  { name: "有问题怎么问", group: "sentence", description: "有回信地址时请对方直接回复，没有时指向官网意见箱", kinds: ALL, multiline: false },
  { name: "不清楚怎么问", group: "sentence", description: "同上，开头是「有不清楚的地方」", kinds: ALL, multiline: false },
  { name: "来不了怎么说", group: "sentence", description: "待面试时请对方改约：有回信地址时请对方回复，没有时指向官网意见箱", kinds: ["interview"], multiline: false },
  { name: "面试说明提示", group: "sentence", description: "填了面试说明时是「面试说明在信里。」，没填是空的", kinds: ["interview"], multiline: false },
  { name: "接下来未填时", group: "sentence", description: "没填「接下来要做的事」时是「接下来的安排我们会另外发邮件告诉你。」，填了是空的", kinds: ["accepted"], multiline: false },
];

const VARIABLE_BY_NAME = new Map(TEMPLATE_VARIABLES.map(variable => [variable.name, variable]));
export const variableByName = (name: string): TemplateVariable | undefined => VARIABLE_BY_NAME.get(name);

/** 变量名到值；没有的变量按空字符串替换。 */
export type TemplateValues = Record<string, string>;

const TOKEN = /\{\{([^{}]*)\}\}/g;

/** 文字里写了哪些占位符（去掉两边空格的名字，按出现顺序，可重复）。 */
export function placeholdersOf(text: string): string[] {
  return [...text.matchAll(TOKEN)].map(match => match[1].trim());
}

/** 单次替换：值不会被再次扫描，所以值里的 {{…}} 只是普通文字。 */
export function fillText(text: string, values: TemplateValues): string {
  return text.replace(TOKEN, (_all, name: string) => values[name.trim()] ?? "");
}

function lines(value: string): string[] {
  return value.split(/\r\n?|\n/).map(line => line.trim()).filter(Boolean);
}

/** 列表项整条只写一个多行变量（例如 {{说明}}）时，每一行展开成一条；其余的按文字替换。 */
function expandItem(item: string, values: TemplateValues): string[] {
  const only = /^\{\{([^{}]*)\}\}$/.exec(item.trim());
  if (only && variableByName(only[1].trim())?.multiline) return lines(values[only[1].trim()] ?? "");
  const filled = fillText(item, values);
  return filled.trim() ? [filled] : [];
}

const SERIAL_FACT = /^\{\{\s*报名编号\s*\}\}$/;

export type FillContext = {
  /** 站点首页：https://yangtzeu.work 或 https://prev.yangtzeu.work */
  siteOrigin: string;
  /** 这封信的落款时间 */
  sentAt: Date | number;
  replyTo?: string;
};

/** 站内页面的完整地址；拼出来的结果也要过链接白名单，路径写成 //evil.example/ 这样的会被拒绝。 */
export function sitePage(origin: string, path: string): string {
  return safeMailLink(new URL(path, safeMailLink(origin)).href);
}

/**
 * 把模板内容和变量值拼成一封信（EnvelopeMessage）。替换后为空的段落、列表、信息表的行直接去掉，引用留给 renderEnvelope 去掉；
 * 信息表里内容只写 {{报名编号}} 的行用等宽字体。拼好的信交给 renderEnvelope 渲染。
 */
export function fillTemplate(content: TemplateContent, values: TemplateValues, context: FillContext): EnvelopeMessage {
  const fill = (text: string) => fillText(text, values);
  const blocks: EnvelopeBlock[] = [];
  for (const block of content.blocks) {
    if (block.kind === "paragraph") {
      const text = fill(block.text);
      if (text.trim()) blocks.push({ kind: "paragraph", text });
    } else if (block.kind === "list") {
      const items = block.items.flatMap(item => expandItem(item, values));
      if (items.length) blocks.push(block.title ? { kind: "list", title: fill(block.title), items } : { kind: "list", items });
    } else if (block.kind === "facts") {
      const items = block.items
        .map(item => ({ label: fill(item.label), value: fill(item.value), mono: SERIAL_FACT.test(item.value.trim()) }))
        .filter(item => item.value.trim())
        .map(item => (item.mono ? item : { label: item.label, value: item.value }));
      if (items.length) blocks.push(block.title ? { kind: "facts", title: fill(block.title), items } : { kind: "facts", items });
    } else {
      // 引用没有内容时由 renderEnvelope 整块去掉，和改成数据之前一样不在这里先丢，输出的 HTML 才逐字相同
      blocks.push({ kind: "quote", title: fill(block.title), text: fill(block.text) });
    }
  }
  return {
    subject: fill(content.subject),
    preheader: fill(content.preheader),
    kicker: fill(content.kicker),
    greeting: fill(content.greeting),
    blocks,
    action: content.button ? { label: fill(content.button.label), url: sitePage(context.siteOrigin, content.button.path) } : undefined,
    signedAt: context.sentAt,
    footer: content.footer.map(fill),
    siteUrl: sitePage(context.siteOrigin, "/"),
    replyTo: context.replyTo,
  };
}

export type TemplateIssue = { path: string; message: string };

const KIND_LABELS: Record<RecruitmentKind, string> = { received: "已收到", interview: "待面试", accepted: "已录取", rejected: "未通过" };
export const kindLabel = (kind: RecruitmentKind): string => KIND_LABELS[kind];

/** 单行文字：去掉控制字符，换行变空格。 */
const single = (value: string) => oneLine(value);
/** 多行文字：每行单独去掉控制字符，保留换行和空行，去掉首尾空白。 */
const multi = (value: string) => value.split(/\r\n?|\n|\u2028|\u2029/).map(oneLine).join("\n").trim();

const BUTTON_PATH = /^\/[A-Za-z0-9._~!$&'()*+,;=:@%/?#-]*$/;

type Raw = Record<string, unknown>;
const isRaw = (value: unknown): value is Raw => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * 核对一份模板的内容并整理成 TemplateContent：长度、块的结构、变量是不是清单里的、是不是这一类信有的。
 * 缺的选填项取默认（摘要、小字为空，抬头是 {{称呼}}，没有按钮和页脚）。第一个问题之外的问题也一起列出来，前端按 path 标在对应的输入框上。
 */
export function normalizeContent(kind: RecruitmentKind, raw: Raw): { content: TemplateContent; issues: TemplateIssue[] } {
  const issues: TemplateIssue[] = [];
  const issue = (path: string, message: string) => issues.push({ path, message });
  let total = 0;
  const L = TEMPLATE_LIMITS;

  /** 取一个文字字段：类型、长度、占位符都在这里核对。 */
  function text(value: unknown, path: string, max: number, options: { multiline?: boolean; required?: boolean; label: string }): string {
    if (value === undefined || value === null) {
      if (options.required) issue(path, `${options.label}不能为空`);
      return "";
    }
    if (typeof value !== "string") {
      issue(path, `${options.label}要写成文字`);
      return "";
    }
    const clean = options.multiline ? multi(value) : single(value);
    if (!clean && options.required) issue(path, `${options.label}不能为空`);
    if ([...clean].length > max) issue(path, `${options.label}最多 ${max} 个字`);
    total += [...clean].length;
    placeholders(clean, path, options.label);
    return clean;
  }

  function placeholders(value: string, path: string, label: string) {
    for (const name of placeholdersOf(value)) {
      const variable = variableByName(name);
      if (!name) issue(path, `${label}里有空的 {{ }}，要写变量名`);
      else if (!variable) issue(path, `${label}里的「${name}」不是可用的变量`);
      else if (!variable.kinds.includes(kind)) {
        issue(path, `「${name}」只能用在${variable.kinds.map(item => `「${KIND_LABELS[item]}」`).join("、")}的信里，不能用在「${KIND_LABELS[kind]}」的信里`);
      }
    }
    if (value.replace(TOKEN, "").match(/\{\{|\}\}/)) issue(path, `${label}里的 {{ 和 }} 没有配成对，变量要写成 {{变量名}}`);
  }

  const subject = text(raw.subject, "subject", L.subject, { required: true, label: "主题" });
  const preheader = text(raw.preheader, "preheader", L.preheader, { label: "摘要" });
  const kicker = text(raw.kicker, "kicker", L.kicker, { label: "小标题" });
  const greeting = raw.greeting === undefined ? "{{称呼}}" : text(raw.greeting, "greeting", L.greeting, { required: true, label: "抬头" });

  const blocks: TemplateBlock[] = [];
  if (!Array.isArray(raw.blocks)) issue("blocks", "正文要写成一个块的列表");
  else {
    if (raw.blocks.length < 1) issue("blocks", "正文至少要有一块");
    if (raw.blocks.length > L.blocks) issue("blocks", `正文最多 ${L.blocks} 块`);
    raw.blocks.slice(0, L.blocks).forEach((entry, index) => {
      const at = `blocks[${index}]`;
      const where = `第 ${index + 1} 块`;
      if (!isRaw(entry) || typeof entry.kind !== "string" || !(TEMPLATE_BLOCK_KINDS as readonly string[]).includes(entry.kind)) {
        issue(at, `${where}的类型要是段落、列表、信息表或引用`);
        return;
      }
      const extraKeys = Object.keys(entry).filter(key => !["kind", "text", "title", "items"].includes(key));
      if (extraKeys.length) issue(at, `${where}多了不认识的内容：${extraKeys.join("、")}`);
      if (entry.kind === "paragraph") {
        blocks.push({ kind: "paragraph", text: text(entry.text, `${at}.text`, L.paragraph, { multiline: true, required: true, label: `${where}的段落` }) });
      } else if (entry.kind === "quote") {
        blocks.push({
          kind: "quote",
          title: text(entry.title, `${at}.title`, L.title, { required: true, label: `${where}的标题` }),
          text: text(entry.text, `${at}.text`, L.quote, { multiline: true, required: true, label: `${where}的引用` }),
        });
      } else if (entry.kind === "list") {
        const items: string[] = [];
        if (!Array.isArray(entry.items) || entry.items.length < 1) issue(`${at}.items`, `${where}的列表至少要有一条`);
        else {
          if (entry.items.length > L.listItems) issue(`${at}.items`, `${where}的列表最多 ${L.listItems} 条`);
          entry.items.slice(0, L.listItems).forEach((item, i) => items.push(text(item, `${at}.items[${i}]`, L.listItem, { multiline: true, required: true, label: `${where}的第 ${i + 1} 条` })));
        }
        const title = entry.title === undefined || entry.title === "" ? undefined : text(entry.title, `${at}.title`, L.title, { label: `${where}的标题` });
        blocks.push(title ? { kind: "list", title, items } : { kind: "list", items });
      } else {
        const items: TemplateFact[] = [];
        if (!Array.isArray(entry.items) || entry.items.length < 1) issue(`${at}.items`, `${where}的信息表至少要有一行`);
        else {
          if (entry.items.length > L.factItems) issue(`${at}.items`, `${where}的信息表最多 ${L.factItems} 行`);
          entry.items.slice(0, L.factItems).forEach((item, i) => {
            const row = `${at}.items[${i}]`;
            if (!isRaw(item)) {
              issue(row, `${where}的第 ${i + 1} 行要写成「名称、内容」`);
              return;
            }
            const extra = Object.keys(item).filter(key => !["label", "value"].includes(key));
            if (extra.length) issue(row, `${where}的第 ${i + 1} 行多了不认识的内容：${extra.join("、")}`);
            items.push({
              label: text(item.label, `${row}.label`, L.factLabel, { required: true, label: `${where}第 ${i + 1} 行的名称` }),
              value: text(item.value, `${row}.value`, L.factValue, { required: true, label: `${where}第 ${i + 1} 行的内容` }),
            });
          });
        }
        const title = entry.title === undefined || entry.title === "" ? undefined : text(entry.title, `${at}.title`, L.title, { label: `${where}的标题` });
        blocks.push(title ? { kind: "facts", title, items } : { kind: "facts", items });
      }
    });
  }

  let button: TemplateButton | null = null;
  if (raw.button !== undefined && raw.button !== null) {
    if (!isRaw(raw.button)) issue("button", "按钮要写成「文字、路径」");
    else {
      const label = text(raw.button.label, "button.label", L.buttonLabel, { required: true, label: "按钮文字" });
      const path = typeof raw.button.path === "string" ? raw.button.path.trim() : "";
      if (!path) issue("button.path", "按钮要指向官网的一个页面，路径从 / 开始");
      else if (path.length > L.buttonPath || !BUTTON_PATH.test(path) || path.startsWith("//")) issue("button.path", "按钮的路径要从 / 开始，只写官网自己的页面，例如 /forum/");
      else {
        try {
          sitePage("https://yangtzeu.work", path);
        } catch {
          issue("button.path", "按钮只能指向官网自己的页面");
        }
      }
      button = { label, path };
    }
  }

  const footer: string[] = [];
  if (raw.footer !== undefined && raw.footer !== null) {
    if (!Array.isArray(raw.footer)) issue("footer", "页脚要写成一行一条");
    else {
      if (raw.footer.length > L.footerLines) issue("footer", `页脚最多 ${L.footerLines} 行`);
      raw.footer.slice(0, L.footerLines).forEach((line, i) => {
        const value = text(line, `footer[${i}]`, L.footerLine, { label: `页脚第 ${i + 1} 行` });
        if (value) footer.push(value);
      });
    }
  }

  if (total > L.totalText) issue("blocks", `整份模板的文字加起来最多 ${L.totalText} 个字，现在有 ${total} 个`);
  return { content: { subject, preheader, kicker, greeting, blocks, button, footer }, issues };
}

const APPLICANT_FACTS: TemplateFact[] = [
  { label: "姓名", value: "{{姓名}}" },
  { label: "班级", value: "{{班级}}" },
  { label: "邮箱", value: "{{邮箱}}" },
  { label: "投递时间", value: "{{投递时间}}" },
  { label: "报名编号", value: "{{报名编号}}" },
];
const applicantFacts = (): TemplateBlock => ({ kind: "facts", title: "你的报名信息", items: APPLICANT_FACTS.map(item => ({ ...item })) });

const FOOTER_LINES = ["你在长江大学极客班官网报名时填写了这个邮箱，所以会收到这封信。", "报名编号 {{报名编号}}"];
const FORUM_BUTTON: TemplateButton = { label: "去论坛看看", path: "/forum/" };

export type BuiltinTemplate = { id: string; name: string; kind: RecruitmentKind; content: TemplateContent };

/**
 * 四类信现在的内容，抽成数据。内置默认和迁移种子都从这里取；改这里的文字不会改已经入库的模板，
 * 入库之后在控制台里改。
 */
export const DEFAULT_TEMPLATES: Record<RecruitmentKind, BuiltinTemplate> = {
  received: {
    id: "default-received", name: "默认", kind: "received",
    content: {
      subject: "极客班收到了你的报名信",
      preheader: "3 个工作日内我们会用这个邮箱联系你，报名编号在信里。",
      kicker: "招新进度 · 已收到",
      greeting: "{{称呼}}",
      blocks: [
        { kind: "paragraph", text: "你寄给极客班的报名信，我们已经收到了。3 个工作日内会有人看完，并用这个邮箱联系你。" },
        applicantFacts(),
        { kind: "quote", title: "你写的特长与优点", text: "{{特长}}" },
        { kind: "paragraph", text: "官网上查不到进度，面试安排和结果都会发到这个邮箱，记得也看一眼垃圾邮件。{{有问题怎么问}}。" },
        { kind: "paragraph", text: "等消息的这几天，可以先去论坛逛逛，看看大家在做什么。" },
      ],
      button: { ...FORUM_BUTTON },
      footer: [...FOOTER_LINES],
    },
  },
  interview: {
    id: "default-interview", name: "默认", kind: "interview",
    content: {
      subject: "极客班面试安排：{{面试时间}}",
      preheader: "{{面试时间}}，{{面试地点}}。{{面试说明提示}}",
      kicker: "招新进度 · 待面试",
      greeting: "{{称呼}}",
      blocks: [
        { kind: "paragraph", text: "你的报名信我们看过了，想请你来当面聊一聊。" },
        { kind: "facts", items: [{ label: "时间", value: "{{面试时间}}" }, { label: "地点", value: "{{面试地点}}" }] },
        { kind: "list", title: "面试说明", items: ["{{说明}}"] },
        { kind: "paragraph", text: "{{来不了怎么说}}。" },
        applicantFacts(),
      ],
      button: null,
      footer: [...FOOTER_LINES],
    },
  },
  accepted: {
    id: "default-accepted", name: "默认", kind: "accepted",
    content: {
      subject: "你已通过极客班招新",
      preheader: "欢迎加入长江大学极客班，接下来的安排在信里。",
      kicker: "招新进度 · 已录取",
      greeting: "{{称呼}}",
      blocks: [
        { kind: "paragraph", text: "你通过了这一轮招新，欢迎加入长江大学极客班。" },
        { kind: "list", title: "接下来", items: ["{{说明}}"] },
        { kind: "paragraph", text: "{{接下来未填时}}" },
        { kind: "paragraph", text: "{{不清楚怎么问}}。" },
        applicantFacts(),
      ],
      button: null,
      footer: [...FOOTER_LINES],
    },
  },
  rejected: {
    id: "default-rejected", name: "默认", kind: "rejected",
    content: {
      subject: "极客班招新结果",
      preheader: "谢谢你给极客班写信，这一轮的结果在信里。",
      kicker: "招新进度 · 结果",
      greeting: "{{称呼}}",
      blocks: [
        { kind: "paragraph", text: "谢谢你给极客班写信，把做过的事和想做的事讲给我们听。" },
        { kind: "paragraph", text: "这一轮没能请你加入极客班。" },
        { kind: "paragraph", text: "{{说明}}" },
        { kind: "paragraph", text: "论坛不登录只能看公开的帖子，发帖、回复要先登录。下一轮招新开始时，欢迎你再写信来。" },
        applicantFacts(),
      ],
      button: { ...FORUM_BUTTON },
      footer: [...FOOTER_LINES],
    },
  },
};

/** 首次迁移除了四套「默认」之外多种的一套，版式更短，验收时每类信能有两套可选。 */
export const EXTRA_TEMPLATES: readonly BuiltinTemplate[] = [
  {
    id: "interview-short", name: "面试邀请 · 简短", kind: "interview",
    content: {
      subject: "极客班面试：{{面试时间}}",
      preheader: "{{面试时间}}，{{面试地点}}",
      kicker: "招新进度 · 待面试",
      greeting: "{{称呼}}",
      blocks: [
        { kind: "paragraph", text: "请按下面的时间和地点来面试。" },
        { kind: "facts", items: [{ label: "时间", value: "{{面试时间}}" }, { label: "地点", value: "{{面试地点}}" }] },
        { kind: "list", title: "面试说明", items: ["{{说明}}"] },
        { kind: "paragraph", text: "{{来不了怎么说}}。" },
      ],
      button: null,
      footer: [...FOOTER_LINES],
    },
  },
];

/** 首次迁移要写进库的全部模板：每类一套「默认」加上额外的。 */
export const SEED_TEMPLATES: readonly BuiltinTemplate[] = [...RECRUITMENT_KINDS.map(kind => DEFAULT_TEMPLATES[kind]), ...EXTRA_TEMPLATES];

/** 预览和试发用的示例投递与示例信的内容。 */
export const SAMPLE_APPLICATION = {
  id: "示例编号-0001",
  name: "张三",
  class_name: "计科 2301 班",
  email: "zhangsan@example.com",
  strengths: "做过一个课表小程序，\n后端用 Go，前端用 Vue。",
  /** 2026-09-27 01:30（北京时间） */
  created_at: Date.UTC(2026, 8, 26, 17, 30),
};
export const SAMPLE_LETTER = {
  time: "9 月 30 日（周三）19:00",
  place: "东校区 3 教 301",
  notes: "面试大约 20 分钟。\n带上学生证。",
  message: "这一轮我们更想找做过后端项目的同学。",
};
