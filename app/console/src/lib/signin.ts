// 登录结果与提示：未成功登录时的原因解析及下一步引导行动点。
import { siteUrl } from "./runtime";

export interface OutcomeAction {
  label: string;
  icon: string;
  href: string;
  target?: "_blank" | "_self";
}

export interface OutcomeInfo {
  type: "warning" | "info";
  title: string;
  body?: string;
  action?: OutcomeAction;
}

export const GITHUB_INVITATION_URL = "https://github.com/orgs/Yangtze-University-Geek-Class/invitation";

export function signInOutcomes(): Record<string, OutcomeInfo> {
  return {
    not_member: {
      type: "warning",
      title: "只有极客班成员可以登录",
      body: "这个 GitHub 账号不在极客班的 GitHub 组织里，控制台只对成员开放。",
      action: {
        label: "申请加入极客班",
        icon: "i-carbon-email",
        href: siteUrl("portal", "/join-us"),
      },
    },
    invite_pending: {
      type: "warning",
      title: "还没接受组织邀请",
      body: "到 GitHub 的通知或邮件里接受极客班组织的邀请，再回来登录。",
      action: {
        label: "前往 GitHub 接受邀请",
        icon: "i-carbon-launch",
        href: GITHUB_INVITATION_URL,
        target: "_blank",
      },
    },
    cancelled: { type: "info", title: "已取消登录" },
    failed: { type: "warning", title: "登录没有完成", body: "请稍后再试一次。" },
  };
}

export function parseSignInOutcome(raw: unknown): OutcomeInfo | null {
  if (typeof raw !== "string") return null;
  const outcomes = signInOutcomes();
  return outcomes[raw] ?? null;
}
