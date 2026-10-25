// 把接口错误翻成用户能看懂的一段话：出了什么事、下一步做什么。纯函数，tests/console 直接测。
import { ApiError } from "./http";
import { ASSIGNER_TEXT } from "./levels";
import { nodeLabel } from "./permission-nodes";

export type ErrorView = {
  kind: "signed_out" | "step_up" | "forbidden" | "not_found" | "read_only" | "rate_limited" | "invalid" | "conflict" | "server" | "network";
  title: string;
  detail: string;
  code: string;
  status: number | null;
  requestId: string | null;
  capability: string | null;
};

/**
 * `labelOf` 把权限节点换成中文名；默认用本地固定表（lib/permission-nodes.ts）。
 * `assigner` 是能管权限的人的称呼。
 */
export function describeError(error: unknown, labelOf: (node: string) => string = nodeLabel, assigner = ASSIGNER_TEXT): ErrorView {
  if (!(error instanceof ApiError)) {
    return {
      kind: "network", title: "连不上服务器", detail: "请检查网络后重试。", code: "network_error",
      status: null, requestId: null, capability: null,
    };
  }
  const payload = error.payload ?? {};
  const capability = typeof payload.node === "string" ? payload.node : null;
  const base = { code: error.code, status: error.status, requestId: error.requestId ?? null, capability };

  if (error.status === 401) return { ...base, kind: "signed_out", title: "登录已失效", detail: "请重新登录。" };
  if (error.status === 403 && error.code === "forbidden" && capability) {
    const name = labelOf(capability);
    return { ...base, kind: "forbidden", title: `没有「${name}」权限`, detail: `请联系${assigner}，为你的账号或所在组加上这项权限。` };
  }
  if (error.status === 403 && error.code === "step_up_required") {
    return { ...base, kind: "step_up", title: "需要重新登录", detail: "控制台里的改动要求刚登录过。重新登录后会回到这一页，再操作一次即可。" };
  }
  if (error.status === 403) return { ...base, kind: "forbidden", title: "没有权限", detail: error.message || "当前账号不能执行这个操作。" };
  if (error.status === 404) return { ...base, kind: "not_found", title: "找不到这条记录", detail: "它可能已被删除，或者链接有误。" };
  if (error.status === 501 && error.code === "mock_read_only") {
    return { ...base, kind: "read_only", title: "开发预览是只读的", detail: "样板数据不能保存修改。要验证写操作，请连接本地后端。" };
  }
  if (error.status === 409) return { ...base, kind: "conflict", title: "操作冲突", detail: error.message };
  if (error.status === 429) {
    const retryAfter = typeof payload.retry_after === "number" ? payload.retry_after : null;
    return { ...base, kind: "rate_limited", title: "操作太频繁", detail: retryAfter ? `请 ${retryAfter} 秒后再试。` : "请稍等再试。" };
  }
  if (error.status >= 400 && error.status < 500) return { ...base, kind: "invalid", title: "请求没有通过校验", detail: error.message };
  return { ...base, kind: "server", title: "服务器出错了", detail: "请稍后重试；如果一直失败，请把下面的编号发给维护者。" };
}

/**
 * 错误卡片的主按钮。登录已失效时重试只会再拿到 401，要求重新确认身份（step_up_required）时重试也只会再被拦，
 * 两种都给「重新登录」（登录后回到当前页）；其余错误（含 5xx 和网络错误）调用方给了重试才给「重试」（#133）。
 */
export type ErrorAction = { kind: "signin" | "retry"; label: string; variant: "primary" | "secondary" };
export function errorAction(view: Pick<ErrorView, "kind">, canRetry: boolean): ErrorAction | null {
  if (view.kind === "signed_out" || view.kind === "step_up") return { kind: "signin", label: "重新登录", variant: "primary" };
  return canRetry ? { kind: "retry", label: "重试", variant: "secondary" } : null;
}

/** 一行技术信息：HTTP 状态、机器码、请求编号（用等宽字体显示）。 */
export function errorTrace(view: ErrorView): string {
  const parts = [view.status ? `HTTP ${view.status}` : null, view.code, view.capability, view.requestId ? `request ${view.requestId}` : null];
  return parts.filter(Boolean).join(" · ");
}
