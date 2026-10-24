import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, requestJson } from "../../app/console/src/lib/http";
import { describeError, errorAction, errorTrace } from "../../app/console/src/lib/errors";

afterEach(() => vi.unstubAllGlobals());

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("requestJson", () => {
  it("sends same-origin credentials and a JSON content type for string bodies", async () => {
    const fetch = vi.fn().mockResolvedValue(json(200, { ok: true }));
    vi.stubGlobal("fetch", fetch);
    await expect(requestJson("/api/x", { method: "POST", body: "{}" })).resolves.toEqual({ ok: true });
    const init = fetch.mock.calls[0][1] as RequestInit;
    expect(init.credentials).toBe("same-origin");
    expect((init.headers as Headers).get("Content-Type")).toBe("application/json");
  });

  it("keeps the server's error shape: status, code, message, request id and payload", async () => {
    const body = { error: "forbidden", node: "activity.read", message: "需要「查看操作记录」权限", request_id: "req-1" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(403, body)));
    await expect(requestJson("/api/console/activity")).rejects.toMatchObject({
      name: "ApiError", status: 403, code: "forbidden", message: "需要「查看操作记录」权限", requestId: "req-1", payload: body,
    });
  });

  it("falls back to a readable message when the body is not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Bad Gateway", { status: 502 })));
    await expect(requestJson("/api/x")).rejects.toMatchObject({ status: 502, code: "request_failed", message: "请求失败（HTTP 502）" });
  });

  it("returns undefined for 204", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(requestJson("/api/x", { method: "DELETE" })).resolves.toBeUndefined();
  });
});

describe("describeError", () => {
  const labels: Record<string, string> = { "activity.read": "查看操作记录", "invite.manage": "管理邀请码" };
  const labelOf = (id: string) => labels[id] ?? id;

  it("names the missing permission node", () => {
    const error = new ApiError(403, "forbidden", "x", undefined, { node: "activity.read" });
    const view = describeError(error, labelOf);
    expect(view.kind).toBe("forbidden");
    expect(view.title).toBe("没有「查看操作记录」权限");
    expect(view.detail).toContain("站长或有权限的部门负责人");
    // 联系谁是数据：传了具体称呼就用它，不用默认的 ASSIGNER_TEXT。
    expect(describeError(error, labelOf, "管理部部长").detail).toContain("请联系管理部部长");
  });

  it("asks for a fresh login when a sensitive action needs step-up, separately from a missing node (#274)", () => {
    const stepUp = describeError(new ApiError(403, "step_up_required", "x"), labelOf);
    expect(stepUp).toMatchObject({ kind: "step_up", title: "需要重新登录" });
    expect(stepUp.detail).toContain("重新登录");
    // 和未登录一样给「重新登录」按钮（/signin?return_to=…），不给「重试」
    expect(errorAction(stepUp, true)).toMatchObject({ kind: "signin", label: "重新登录" });
    expect(errorAction(describeError(new ApiError(401, "not_signed_in", "x")), true)).toMatchObject({ kind: "signin" });
    // 缺节点不带「重新登录」的说法：只说找谁加权限
    const denied = describeError(new ApiError(403, "forbidden", "x", undefined, { node: "invite.manage" }), labelOf);
    expect(denied.title).toBe("没有「管理邀请码」权限");
    expect(denied.detail).toContain("加上这项权限");
  });

  it("maps sign-out, not found, read-only preview, rate limit and server errors", () => {
    expect(describeError(new ApiError(401, "not_signed_in", "x")).kind).toBe("signed_out");
    expect(describeError(new ApiError(404, "not_found", "x")).kind).toBe("not_found");
    expect(describeError(new ApiError(501, "mock_read_only", "x")).kind).toBe("read_only");
    expect(describeError(new ApiError(429, "rate_limited", "x")).kind).toBe("rate_limited");
    expect(describeError(new ApiError(500, "internal_error", "x")).kind).toBe("server");
  });

  it("names a wait time from retry_after when the server gives one", () => {
    expect(describeError(new ApiError(429, "rate_limited", "x", undefined, { retry_after: 30 })).detail).toBe("请 30 秒后再试。");
    expect(describeError(new ApiError(429, "rate_limited", "x")).detail).toBe("请稍等再试。");
  });

  it("keeps a validation message from the server", () => {
    expect(describeError(new ApiError(400, "department_required", "请选择部门")).detail).toBe("请选择部门");
  });

  it("treats anything that is not an ApiError as a network failure", () => {
    expect(describeError(new TypeError("Failed to fetch"))).toMatchObject({ kind: "network", status: null });
  });

  it("prints a one-line trace with status, code, node and request id", () => {
    const view = describeError(new ApiError(403, "forbidden", "x", "req-9", { node: "activity.read" }), labelOf);
    expect(errorTrace(view)).toBe("HTTP 403 · forbidden · activity.read · request req-9");
  });
});
