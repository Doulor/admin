import { formatMailDateTime, oneLine, required, safeMailLink, type EnvelopeMessage } from "./envelope.js";
import {
  DEFAULT_TEMPLATES, fillTemplate, type RecruitmentKind, type TemplateContent, type TemplateValues,
} from "./template-content.js";

/**
 * 招新流程的四封信（#148）：投递成功、待面试、已录取、未通过。
 * 只拼内容（EnvelopeMessage），版式和转义由 renderEnvelope 负责；什么时候发、发给谁由发信模块决定。
 * 只为 received / interview / accepted / rejected 拼信；控制台的 cancelled 没有通知信。
 *
 * 信的文字不写在这里了（#285）：它们是 template-content.ts 里的模板数据（DEFAULT_TEMPLATES 是内置默认，
 * 也是迁移种子），这里只把投递和控制台填的内容变成模板变量（recruitmentValues），再交给 fillTemplate 拼成信。
 * 没传模板时用内置默认，输出和改成数据之前逐字相同。
 *
 * 每封信默认都附上「你的报名信息」（姓名、班级、邮箱、投递时间、报名编号），已收到的信另外原样引用特长与优点；
 * 抬头按姓称呼（「张同学，你好：」，greetingFor）。时间一律按北京时间写（formatMailDateTime）。
 *
 * 回信：给了 replyTo，信里才请对方「直接回复这封邮件」，没给就指向官网意见箱（待面试的信也一样），
 * 这几句整句写在变量里（有问题怎么问、不清楚怎么问、来不了怎么说）。renderEnvelope 会拒绝请人回复却没有 replyTo 的信。
 */

export type { RecruitmentKind } from "./template-content.js";

type Common = {
  /** 投递人填写的姓名 */
  name: string;
  /** 投递人填写的班级 */
  className: string;
  /** 投递人填写的邮箱，也就是收件地址 */
  email: string;
  /** 投递时间（applications.created_at） */
  submittedAt: Date | number;
  /** applications.id */
  applicationId: string;
  /** 站点首页：https://yangtzeu.work 或 https://prev.yangtzeu.work */
  siteOrigin: string;
  /** 这封信的落款时间 */
  sentAt: Date | number;
  /** 回信地址：有人在看的邮箱，发信模块写进 Reply-To */
  replyTo?: string;
  /** 投递人写的特长与优点；模板里的 {{特长}} 取它，已收到的信必填（ReceivedInput），其余的信可以不给 */
  strengths?: string;
};

export type ReceivedInput = Common & {
  /** 投递人写的特长与优点，信里原样引用 */
  strengths: string;
};
export type InterviewInput = Common & {
  /** 面试时间，写成给人看的样子，例如「9 月 30 日（周三）19:00」 */
  time: string;
  place: string;
  /** 面试说明，一条一行 */
  notes?: readonly string[];
};
export type AcceptedInput = Common & {
  /** 接下来要做的事，一条一行 */
  steps?: readonly string[];
  /** 按钮，例如组织邀请链接；只能指向 yangtzeu.work / prev.yangtzeu.work */
  action?: { label: string; url: string };
};
export type RejectedInput = Common & {
  /** 这一轮没请对方加入的原因，由改状态的人写；不写信里就不提原因 */
  reason?: string;
};

export type RecruitmentInput = {
  received: ReceivedInput;
  interview: InterviewInput;
  accepted: AcceptedInput;
  rejected: RejectedInput;
};

const CJK_END = /[㐀-鿿豈-﫿]$/;
const HAN = /^\p{Script=Han}$/u;

/** 复姓：名字以其中一个开头、并且至少三个字时，按复姓称呼（欧阳娜娜 → 欧阳同学）。 */
export const COMPOUND_SURNAMES: readonly string[] = [
  "欧阳", "司马", "上官", "诸葛", "东方", "皇甫", "尉迟", "公孙", "慕容", "长孙", "宇文", "司徒", "夏侯",
  "轩辕", "令狐", "钟离", "闻人", "澹台", "公冶", "太叔", "申屠", "赫连", "端木", "呼延", "南宫", "西门",
  "独孤", "万俟", "百里", "东郭", "拓跋", "第五", "左丘", "濮阳", "淳于", "仲孙", "叱干",
];

/**
 * 抬头按姓称呼（2026-09-27）：汉字开头的名字取姓，张三 →「张同学，你好：」，欧阳娜娜 →「欧阳同学，你好：」；
 * 只有两个字的名字一律按单姓（欧阳 →「欧同学」），分不清是复姓还是姓加名。
 * 清单里不放「单于」：它是称号，几乎没有人姓单于，而姓单、名字以「于」开头的人不少（单于洋 →「单同学」）。
 * 不是汉字开头的名字（拉丁字母等）照写全名，以字母结尾时中间空一格（「Alice 同学，你好：」）；没有名字时只写「你好：」。
 * 事实栏里仍写全名。
 */
export function greetingFor(name: string): string {
  const clean = oneLine(name);
  if (!clean) return "你好：";
  const chars = Array.from(clean);
  if (HAN.test(chars[0])) {
    const two = chars.slice(0, 2).join("");
    const surname = chars.length >= 3 && COMPOUND_SURNAMES.includes(two) ? two : chars[0];
    return `${surname}同学，你好：`;
  }
  return `${clean}${CJK_END.test(clean) ? "" : " "}同学，你好：`;
}

/** 没有回信地址时，有问题去哪里问 */
const ASK_ON_FEEDBACK = "可以到官网的意见箱留言，联系方式一栏填这个邮箱";

type Filled = Common & { time?: string; place?: string; notes?: readonly string[]; steps?: readonly string[]; reason?: string };

const filled = (items: readonly string[] | undefined): string[] => (items ?? []).filter(item => item.trim());

/**
 * 把一封信的输入变成模板变量（TEMPLATE_VARIABLES 的每一项）。待面试的时间和地点必填，空的抛 MailTemplateError；
 * 站点地址不是正式或预发布站点同样抛错。有没有回信地址、有没有填说明，决定「整句」变量写成什么。
 */
export function recruitmentValues(kind: RecruitmentKind, input: Filled): TemplateValues {
  const time = kind === "interview" ? required(oneLine(input.time ?? ""), "面试时间") : "";
  const place = kind === "interview" ? required(oneLine(input.place ?? ""), "面试地点") : "";
  const notes = filled(input.notes);
  const steps = filled(input.steps);
  const reply = Boolean(input.replyTo);
  return {
    称呼: greetingFor(input.name),
    姓名: input.name,
    班级: input.className,
    邮箱: input.email,
    投递时间: `${formatMailDateTime(input.submittedAt)}（北京时间）`,
    报名编号: oneLine(input.applicationId),
    特长: input.strengths ?? "",
    官网: new URL(safeMailLink(input.siteOrigin)).origin,
    面试时间: time,
    面试地点: place,
    说明: kind === "interview" ? notes.join("\n") : kind === "accepted" ? steps.join("\n") : kind === "rejected" ? input.reason ?? "" : "",
    有问题怎么问: reply ? "有问题直接回复这封邮件" : `有问题${ASK_ON_FEEDBACK}`,
    不清楚怎么问: reply ? "有不清楚的地方，直接回复这封邮件问我们" : `有不清楚的地方，${ASK_ON_FEEDBACK}`,
    来不了怎么说: reply ? "这个时间来不了的话，直接回复这封邮件说一声，我们再约" : "这个时间来不了的话，到官网的意见箱留言，联系方式一栏填这个邮箱，我们再约",
    面试说明提示: kind === "interview" && notes.length ? "面试说明在信里。" : "",
    接下来未填时: kind === "accepted" && !steps.length ? "接下来的安排我们会另外发邮件告诉你。" : "",
  };
}

/** 按投递状态取信的内容。content 不传时用内置默认模板；传了就按那份模板拼（库里选出来的模板）。 */
export function recruitmentMessage<K extends RecruitmentKind>(kind: K, input: RecruitmentInput[K], content: TemplateContent = DEFAULT_TEMPLATES[kind].content): EnvelopeMessage {
  const message = fillTemplate(content, recruitmentValues(kind, input), { siteOrigin: input.siteOrigin, sentAt: input.sentAt, replyTo: input.replyTo });
  // 已录取的信可以由调用方带一个按钮（例如组织邀请链接），盖过模板里的按钮
  const action = kind === "accepted" ? (input as AcceptedInput).action : undefined;
  return action ? { ...message, action } : message;
}
