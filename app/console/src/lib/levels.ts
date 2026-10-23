// 身份（Level）、账号状态、登录方式与 GitLab 同步状态的中文名（SPEC §3.2）。服务端 /api/console/me 另下发 level_name，
// 这里给列表、筛选项这类没有名字的场合用。
import type { GitlabSyncState, Level, SessionProvider, UserStatus } from "./types";

export const LEVEL_TEXT: Record<Level, string> = {
  visitor: "访客", registered: "注册用户", member: "极客班成员", alumni: "往届成员",
};
export const LEVELS: Level[] = ["visitor", "registered", "member", "alumni"];
/** 能在「用户」里改成的身份：访客是没登录的人，不出现在选项里。 */
export const ASSIGNABLE_LEVELS: Exclude<Level, "visitor">[] = ["registered", "member", "alumni"];
export const levelText = (level: string): string => LEVEL_TEXT[level as Level] ?? level;

/** 缺权限时请人去找谁。 */
export const ASSIGNER_TEXT = "站长或有权限的部门负责人";

export const USER_STATUS_TEXT: Record<UserStatus, string> = { active: "正常", disabled: "已停用" };

export const PROVIDER_TEXT: Record<SessionProvider, string> = { email: "邮箱", google: "Google", github: "GitHub" };

export const GITLAB_STATE_TEXT: Record<GitlabSyncState, string> = {
  synced: "已同步", pending: "待同步", failed: "同步失败", blocked: "已封禁", none: "没有账号",
};
