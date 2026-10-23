// 对外授权的同意页（/authorize，#270）的纯逻辑：GitLab 这样的应用用极客班账号登录时，第一次要本人在这里允许。
// 页面经服务端的三个交互接口（app/server/src/routes/oidc/index.ts）读取和提交；地址里只有交互编号 uid。
import { bindEmailPath } from "./signin";

/** 形状与服务端 `GET /oidc/interaction/:uid/details` 一致。 */
export type AuthorizeView = {
  client: { id: string; name: string; host: string };
  scopes: string[];
  account: { login: string; name: string; picture: string | null };
  expires_at: number;
};

const UID = /^[A-Za-z0-9_-]{10,64}$/;
/** 地址里的交互编号；格式不对时为 null（同服务端合同的 pattern）。 */
export const interactionUid = (raw: unknown): string | null => (typeof raw === "string" && UID.test(raw) ? raw : null);

const interactionPath = (uid: string) => `/oidc/interaction/${encodeURIComponent(uid)}`;
export const detailsPath = (uid: string) => `${interactionPath(uid)}/details`;
export const decisionPath = (uid: string, decision: "confirm" | "abort") => `${interactionPath(uid)}/${decision}`;
/** 登录过期时去统一登录页，登录完回到交互入口，由服务端按新的登录状态继续。 */
export const authorizeSignInPath = (uid: string) => `/signin?return_to=${encodeURIComponent(interactionPath(uid))}`;
/** 账号还没有登录邮箱（#273，接口回 403 email_required）：先去绑定邮箱页，绑好同样回到交互入口。 */
export const authorizeBindEmailPath = (uid: string) => bindEmailPath(interactionPath(uid));

const SCOPE_TEXT: Record<string, string> = {
  openid: "确认你是哪位极客班成员（给这个应用单独的账号编号，和别的应用拿到的不同）",
  profile: "读取你的显示名、用户名和头像",
  email: "读取你验证过的邮箱",
};

/** 要的信息逐项说成人话；不认识的原样列出，不藏起来。 */
export const scopeLines = (scopes: string[]): string[] => scopes.map(item => SCOPE_TEXT[item] ?? item);

/** 不能再在这里允许时的说明：交互过期（404）、换了账号（409）、地址里没有交互编号。 */
export function closedNotice(reason: "expired" | "mismatch" | "missing"): { title: string; body: string } {
  if (reason === "expired") return { title: "这次登录已经过期", body: "登录请求只在 10 分钟内有效。回到应用，重新点一次登录。" };
  if (reason === "mismatch") return { title: "当前账号和发起登录的不一致", body: "这个浏览器刚换过极客班账号。回到应用，重新点一次登录。" };
  return { title: "缺少登录请求", body: "这个页面要从应用的「用极客班账号登录」进来。" };
}
