// 开发预览里的招聘邮件模板样板（#285，全部虚构）：模板列表、变量清单，以及预览用的简易渲染。
// 真正的渲染在服务端 lib/mail/envelope.ts；这里只把 {{变量}} 换成示例值、排成最简单的 HTML，让预览区在开发预览里也能随编辑变化。
// 只在 DEV 且数据源为 mock 时由 mock/index.ts 动态导入，生产构建里这段被删掉。
import { ApiError } from "../lib/http";
import type {
  LetterTemplates, MailBlock, MailKind, MailRendered, MailTemplate, MailTemplateContent, MailTemplateIssue, MailTemplateList, MailVariable,
} from "../lib/types";

const KINDS = [
  { id: "received", label: "已收到" }, { id: "interview", label: "待面试" }, { id: "accepted", label: "已录取" }, { id: "rejected", label: "未通过" },
] as const;
const ALL: MailKind[] = ["received", "interview", "accepted", "rejected"];

/** 与服务端 TEMPLATE_VARIABLES 一致的清单（app/server/src/lib/mail/template-content.ts） */
const variable = (name: string, group: string, group_label: string, description: string, kinds: MailKind[], multiline = false): MailVariable => (
  { name, group, group_label, description, kinds, multiline }
);
export const MOCK_MAIL_VARIABLES: MailVariable[] = [
  variable("称呼", "applicant", "投递人", "抬头用的称呼，按姓写，例如「张同学，你好：」", ALL),
  variable("姓名", "applicant", "投递人", "投递人填的姓名", ALL),
  variable("班级", "applicant", "投递人", "投递人填的班级", ALL),
  variable("邮箱", "applicant", "投递人", "投递人填的邮箱，也是收信地址", ALL),
  variable("投递时间", "applicant", "投递人", "投递时间，写明是北京时间", ALL),
  variable("报名编号", "applicant", "投递人", "这份投递的编号", ALL),
  variable("特长", "applicant", "投递人", "投递人写的特长与优点，可能有好几行", ALL, true),
  variable("官网", "applicant", "投递人", "官网首页的地址", ALL),
  variable("面试时间", "letter", "改状态时填的", "改成待面试时填的面试时间", ["interview"]),
  variable("面试地点", "letter", "改状态时填的", "改成待面试时填的面试地点", ["interview"]),
  variable("说明", "letter", "改状态时填的", "改状态时填的内容，一行一条：待面试是面试说明，已录取是接下来要做的事，未通过是写给投递人的话", ["interview", "accepted", "rejected"], true),
  variable("有问题怎么问", "sentence", "整句", "有回信地址时请对方直接回复，没有时指向官网意见箱", ALL),
  variable("不清楚怎么问", "sentence", "整句", "同上，开头是「有不清楚的地方」", ALL),
  variable("来不了怎么说", "sentence", "整句", "待面试时请对方改约：有回信地址时请对方回复，没有时指向官网意见箱", ["interview"]),
  variable("面试说明提示", "sentence", "整句", "填了面试说明时是「面试说明在信里。」，没填是空的", ["interview"]),
  variable("接下来未填时", "sentence", "整句", "没填「接下来要做的事」时是「接下来的安排我们会另外发邮件告诉你。」，填了是空的", ["accepted"]),
];

const FACTS: MailBlock = {
  kind: "facts", title: "你的报名信息",
  items: [
    { label: "姓名", value: "{{姓名}}" }, { label: "班级", value: "{{班级}}" }, { label: "邮箱", value: "{{邮箱}}" },
    { label: "投递时间", value: "{{投递时间}}" }, { label: "报名编号", value: "{{报名编号}}" },
  ],
};
const FOOTER = ["你在长江大学极客班官网报名时填写了这个邮箱，所以会收到这封信。", "报名编号 {{报名编号}}"];
const FORUM = { label: "去论坛看看", path: "/forum/" };
const AT = Date.UTC(2026, 9, 25, 4, 0);

function template(id: string, name: string, kind: MailKind, is_default: boolean, enabled: boolean, content: MailTemplateContent): MailTemplate {
  return { id, name, kind, enabled, is_default, ...content, created_by: "migration:2026-10-mail-templates", created_at: AT, updated_by: "migration:2026-10-mail-templates", updated_at: AT };
}

export const MOCK_MAIL_TEMPLATES: MailTemplate[] = [
  template("default-received", "默认", "received", true, true, {
    subject: "极客班收到了你的报名信", preheader: "3 个工作日内我们会用这个邮箱联系你，报名编号在信里。", kicker: "招新进度 · 已收到", greeting: "{{称呼}}",
    blocks: [
      { kind: "paragraph", text: "你寄给极客班的报名信，我们已经收到了。3 个工作日内会有人看完，并用这个邮箱联系你。" },
      FACTS,
      { kind: "quote", title: "你写的特长与优点", text: "{{特长}}" },
      { kind: "paragraph", text: "官网上查不到进度，面试安排和结果都会发到这个邮箱，记得也看一眼垃圾邮件。{{有问题怎么问}}。" },
      { kind: "paragraph", text: "等消息的这几天，可以先去论坛逛逛，看看大家在做什么。" },
    ],
    button: FORUM, footer: FOOTER,
  }),
  template("default-interview", "默认", "interview", true, true, {
    subject: "极客班面试安排：{{面试时间}}", preheader: "{{面试时间}}，{{面试地点}}。{{面试说明提示}}", kicker: "招新进度 · 待面试", greeting: "{{称呼}}",
    blocks: [
      { kind: "paragraph", text: "你的报名信我们看过了，想请你来当面聊一聊。" },
      { kind: "facts", items: [{ label: "时间", value: "{{面试时间}}" }, { label: "地点", value: "{{面试地点}}" }] },
      { kind: "list", title: "面试说明", items: ["{{说明}}"] },
      { kind: "paragraph", text: "{{来不了怎么说}}。" },
      FACTS,
    ],
    button: null, footer: FOOTER,
  }),
  template("interview-short", "面试邀请 · 简短", "interview", false, true, {
    subject: "极客班面试：{{面试时间}}", preheader: "{{面试时间}}，{{面试地点}}", kicker: "招新进度 · 待面试", greeting: "{{称呼}}",
    blocks: [
      { kind: "paragraph", text: "请按下面的时间和地点来面试。" },
      { kind: "facts", items: [{ label: "时间", value: "{{面试时间}}" }, { label: "地点", value: "{{面试地点}}" }] },
      { kind: "list", title: "面试说明", items: ["{{说明}}"] },
      { kind: "paragraph", text: "{{来不了怎么说}}。" },
    ],
    button: null, footer: FOOTER,
  }),
  template("default-accepted", "默认", "accepted", true, true, {
    subject: "你已通过极客班招新", preheader: "欢迎加入长江大学极客班，接下来的安排在信里。", kicker: "招新进度 · 已录取", greeting: "{{称呼}}",
    blocks: [
      { kind: "paragraph", text: "你通过了这一轮招新，欢迎加入长江大学极客班。" },
      { kind: "list", title: "接下来", items: ["{{说明}}"] },
      { kind: "paragraph", text: "{{接下来未填时}}" },
      { kind: "paragraph", text: "{{不清楚怎么问}}。" },
      FACTS,
    ],
    button: null, footer: FOOTER,
  }),
  template("default-rejected", "默认", "rejected", true, true, {
    subject: "极客班招新结果", preheader: "谢谢你给极客班写信，这一轮的结果在信里。", kicker: "招新进度 · 结果", greeting: "{{称呼}}",
    blocks: [
      { kind: "paragraph", text: "谢谢你给极客班写信，把做过的事和想做的事讲给我们听。" },
      { kind: "paragraph", text: "这一轮没能请你加入极客班。" },
      { kind: "paragraph", text: "{{说明}}" },
      { kind: "paragraph", text: "论坛不登录只能看公开的帖子，发帖、回复要先登录。下一轮招新开始时，欢迎你再写信来。" },
      FACTS,
    ],
    button: FORUM, footer: FOOTER,
  }),
  template("sample-rejected-short", "未通过 · 简短", "rejected", false, false, {
    subject: "极客班招新结果", preheader: "这一轮的结果在信里。", kicker: "招新进度 · 结果", greeting: "{{称呼}}",
    blocks: [{ kind: "paragraph", text: "谢谢你给极客班写信。这一轮没能请你加入，下一轮招新开始时，欢迎再写信来。" }],
    button: null, footer: [],
  }),
];

export const MOCK_MAIL_LIST: MailTemplateList = {
  templates: MOCK_MAIL_TEMPLATES,
  kinds: [...KINDS],
  block_kinds: [{ id: "paragraph", label: "段落" }, { id: "list", label: "要点列表" }, { id: "facts", label: "信息表" }, { id: "quote", label: "引用" }],
  variables: MOCK_MAIL_VARIABLES,
  limits: {
    name: 40, subject: 100, preheader: 200, kicker: 60, greeting: 120, blocks: 20, paragraph: 2000, title: 60, listItems: 20, listItem: 500,
    factItems: 12, factLabel: 30, factValue: 500, quote: 2000, footerLines: 4, footerLine: 200, buttonLabel: 30, buttonPath: 200, totalText: 6000,
  },
  mail: { enabled: true, recipients: "allowlist", reply_to: true },
  test_send: { per_hour_per_account: 10, per_hour_site: 30 },
};

/** 改状态时能选的信：每类启用的模板，只有名字 */
export function mockLetterTemplates(): LetterTemplates {
  const pick = (kind: "interview" | "accepted" | "rejected") =>
    MOCK_MAIL_TEMPLATES.filter(item => item.kind === kind && item.enabled).map(item => ({ id: item.id, name: item.name, is_default: item.is_default }));
  return { interview: pick("interview"), accepted: pick("accepted"), rejected: pick("rejected") };
}

// ---- 简易渲染 ----

const esc = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const TOKEN = /\{\{([^{}]*)\}\}/g;
const lines = (value: string) => value.split(/\r\n?|\n/).map(line => line.trim()).filter(Boolean);

export type MockLetter = { time?: string; place?: string; notes?: string; message?: string };
const PERSON = { name: "张三", class_name: "计科 2301 班", strengths: "做过一个课表小程序，\n后端用 Go，前端用 Vue。", email: "zhangsan@example.com", id: "示例编号-0001" };
const LETTER = { time: "9 月 30 日（周三）19:00", place: "东校区 3 教 301", notes: "面试大约 20 分钟。\n带上学生证。", message: "这一轮我们更想找做过后端项目的同学。" };

const present = (value: Record<string, string | undefined>) => Object.fromEntries(Object.entries(value).filter(([, item]) => item && item.trim())) as Record<string, string>;

/** 变量名 → 值。person 是投递人的字段，letter 是改状态时填的内容；都是最终要用的值，这里不再补默认。 */
function valuesOf(kind: MailKind, person: typeof PERSON, letter: MockLetter): Record<string, string> {
  const notes = letter.notes?.trim() ?? "";
  return {
    称呼: `${[...person.name][0] ?? ""}同学，你好：`, 姓名: person.name, 班级: person.class_name, 邮箱: person.email, 投递时间: "2026 年 9 月 27 日 01:30（北京时间）",
    报名编号: person.id, 特长: person.strengths, 官网: "https://yangtzeu.work", 面试时间: letter.time ?? "", 面试地点: letter.place ?? "",
    说明: kind === "rejected" ? letter.message?.trim() ?? "" : notes,
    有问题怎么问: "有问题直接回复这封邮件", 不清楚怎么问: "有不清楚的地方，直接回复这封邮件", 来不了怎么说: "时间不合适或者来不了，直接回复这封邮件，我们另外约",
    面试说明提示: notes ? "面试说明在信里。" : "", 接下来未填时: notes ? "" : "接下来的安排我们会另外发邮件告诉你。",
  };
}

function render(kind: MailKind, content: MailTemplateContent, values: Record<string, string>): MailRendered {
  const fill = (text: string) => text.replace(TOKEN, (_all, name: string) => values[name.trim()] ?? "");
  const item = (text: string) => {
    const only = /^\{\{([^{}]*)\}\}$/.exec(text.trim());
    const multiline = only && MOCK_MAIL_VARIABLES.find(entry => entry.name === only[1].trim())?.multiline;
    return multiline ? lines(values[only![1].trim()] ?? "") : fill(text).trim() ? [fill(text)] : [];
  };
  const body = content.blocks.map(block => {
    if (block.kind === "paragraph") return `<p style="margin:0 0 14px;line-height:24px">${esc(fill(block.text)).replace(/\n/g, "<br>")}</p>`;
    if (block.kind === "quote") return `<div style="margin:0 0 14px;padding:10px 14px;border-left:3px solid #9bb3e8;background:#f3f6fd"><div style="font-size:12px;color:#5b6475">${esc(fill(block.title))}</div><div style="line-height:22px">${esc(fill(block.text)).replace(/\n/g, "<br>")}</div></div>`;
    const title = block.title ? `<div style="margin:0 0 6px;font-size:13px;color:#5b6475">${esc(fill(block.title))}</div>` : "";
    if (block.kind === "list") return `${title}<ul style="margin:0 0 14px;padding-left:20px;line-height:24px">${block.items.flatMap(item).map(entry => `<li>${esc(entry)}</li>`).join("")}</ul>`;
    return `${title}<table style="margin:0 0 14px;border-collapse:collapse;width:100%">${block.items.map(row => `<tr><td style="padding:4px 12px 4px 0;color:#5b6475;white-space:nowrap">${esc(fill(row.label))}</td><td style="padding:4px 0">${esc(fill(row.value))}</td></tr>`).join("")}</table>`;
  }).join("");
  const button = content.button ? `<p style="margin:18px 0"><a href="https://yangtzeu.work${esc(content.button.path)}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#3a78f0;color:#fff;text-decoration:none">${esc(fill(content.button.label))}</a></p>` : "";
  const footer = content.footer.map(line => `<p style="margin:0;font-size:12px;line-height:20px;color:#8a93a6">${esc(fill(line))}</p>`).join("");
  const html = `<!doctype html><html lang="zh-CN"><body style="margin:0;padding:24px;background:#eef1f7;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;color:#1f2a44"><div style="max-width:560px;margin:0 auto;padding:24px;border-radius:12px;background:#fff"><div style="margin:0 0 12px;font-size:12px;color:#8a93a6">${esc(fill(content.kicker))}</div><p style="margin:0 0 14px;font-size:16px">${esc(fill(content.greeting))}</p>${body}${button}<div style="margin-top:20px;padding-top:12px;border-top:1px solid #e5e9f2">${footer}</div></div></body></html>`;
  const text = [fill(content.greeting), ...content.blocks.flatMap(block => block.kind === "paragraph" ? [fill(block.text)] : block.kind === "quote" ? [fill(block.title), fill(block.text)] : block.kind === "list" ? block.items.flatMap(item).map(entry => `- ${entry}`) : block.items.map(row => `${fill(row.label)}：${fill(row.value)}`)), ...content.footer.map(fill)].join("\n\n");
  return { subject: fill(content.subject), html, text };
}

function invalid(issues: MailTemplateIssue[]): never {
  const message = issues[0].message;
  throw new ApiError(400, "template_invalid", message, undefined, { error: "template_invalid", message, issues });
}

/** 与服务端同样的几条常见问题：主题不能空、变量要在清单里并且这一类信里有；其余长度、结构的核对留给真实后端。 */
function check(kind: MailKind, content: MailTemplateContent) {
  const issues: MailTemplateIssue[] = [];
  const scan = (text: string, path: string, label: string) => {
    for (const match of text.matchAll(TOKEN)) {
      const name = match[1].trim();
      const found = MOCK_MAIL_VARIABLES.find(entry => entry.name === name);
      if (!found) issues.push({ path, message: `${label}里的「${name}」不是可用的变量` });
      else if (!found.kinds.includes(kind)) issues.push({ path, message: `「${name}」不能用在「${KINDS.find(entry => entry.id === kind)?.label}」的信里` });
    }
  };
  if (!content.subject.trim()) issues.push({ path: "subject", message: "主题不能为空" });
  scan(content.subject, "subject", "主题");
  scan(content.preheader, "preheader", "摘要");
  scan(content.greeting, "greeting", "抬头");
  content.blocks.forEach((block, index) => {
    if (block.kind === "paragraph" || block.kind === "quote") {
      if (!block.text.trim()) issues.push({ path: `blocks[${index}].text`, message: `第 ${index + 1} 块的${block.kind === "paragraph" ? "段落" : "引用"}不能为空` });
      scan(block.text, `blocks[${index}].text`, `第 ${index + 1} 块`);
    } else if (block.kind === "list") {
      block.items.forEach(entry => scan(entry, `blocks[${index}].items[0]`, `第 ${index + 1} 块`));
    } else {
      block.items.forEach((row, rowIndex) => scan(row.value, `blocks[${index}].items[${rowIndex}].value`, `第 ${index + 1} 块`));
    }
  });
  if (issues.length) invalid(issues);
}

function contentOf(body: Record<string, unknown>): { kind: MailKind; content: MailTemplateContent } {
  const id = body.template_id;
  if (typeof id === "string") {
    const found = MOCK_MAIL_TEMPLATES.find(item => item.id === id);
    if (!found) throw new ApiError(404, "not_found", "模板不存在", undefined, { error: "not_found" });
    return { kind: found.kind, content: found };
  }
  const draft = body.draft as (MailTemplateContent & { kind: MailKind }) | undefined;
  if (!draft) {
    const message = "要么给 template_id（已保存的模板），要么给 draft（还没保存的草稿），不能两个都给或都不给";
    throw new ApiError(400, "template_required", message, undefined, { error: "template_required", message });
  }
  return { kind: draft.kind, content: { subject: draft.subject ?? "", preheader: draft.preheader ?? "", kicker: draft.kicker ?? "", greeting: draft.greeting ?? "", blocks: draft.blocks ?? [], button: draft.button ?? null, footer: draft.footer ?? [] } };
}

/** POST /api/console/mail-templates/preview：用示例投递人，请求里填了的项换掉示例 */
export function mockMailPreview(body: unknown): MailRendered {
  const input = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const { kind, content } = contentOf(input);
  check(kind, content);
  const person = { ...PERSON, ...present((input.sample ?? {}) as Record<string, string>) };
  return render(kind, content, valuesOf(kind, person, { ...LETTER, ...present((input.letter ?? {}) as Record<string, string>) }));
}

/** POST /api/console/applications/:id/letter-preview：用这份投递的真实字段，信的内容只看请求里填的 */
export function mockLetterPreview(application: { name: string; class_name: string; email: string; strengths: string; id: string }, body: unknown): MailRendered {
  const input = (body && typeof body === "object" ? body : {}) as { status?: string; template_id?: string; letter?: MockLetter };
  const kind = input.status as MailKind;
  if (kind !== "interview" && kind !== "accepted" && kind !== "rejected") {
    const message = "只有改成待面试、已录取、未通过才会发信，其它状态没有信可以预览";
    throw new ApiError(400, "no_letter", message, undefined, { error: "no_letter", message });
  }
  const chosen = input.template_id
    ? MOCK_MAIL_TEMPLATES.find(item => item.id === input.template_id && item.kind === kind && item.enabled)
    : MOCK_MAIL_TEMPLATES.find(item => item.kind === kind && item.is_default);
  if (!chosen) {
    const message = "选的这套信不存在、不是这一类，或者已经停用";
    throw new ApiError(400, "template_invalid", message, undefined, { error: "template_invalid", message });
  }
  const letter: MockLetter = { ...input.letter };
  if (kind === "interview") {
    letter.time = letter.time?.trim() || "【面试时间待填】";
    letter.place = letter.place?.trim() || "【面试地点待填】";
  }
  return render(kind, chosen, valuesOf(kind, application, letter));
}
