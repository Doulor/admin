import { describe, expect, it } from "vitest";
import { GITHUB_INVITATION_URL, parseSignInOutcome, signInOutcomes } from "../../app/console/src/lib/signin";

describe("登录结果提示与行动点解析 (signin)", () => {
  it("not_member：提示未加入组织，并提供「申请加入极客班」引导链接", () => {
    const outcome = parseSignInOutcome("not_member");
    expect(outcome).not.toBeNull();
    expect(outcome?.type).toBe("warning");
    expect(outcome?.title).toBe("只有极客班成员可以登录");
    expect(outcome?.body).toContain("不在极客班的 GitHub 组织里");
    expect(outcome?.action).toEqual({
      label: "申请加入极客班",
      icon: "i-carbon-email",
      href: expect.stringContaining("/join-us"),
    });
  });

  it("invite_pending：提示待接受邀请，并提供跳转 GitHub 组织邀请页面的外链", () => {
    const outcome = parseSignInOutcome("invite_pending");
    expect(outcome).not.toBeNull();
    expect(outcome?.type).toBe("warning");
    expect(outcome?.title).toBe("还没接受组织邀请");
    expect(outcome?.body).toContain("接受极客班组织的邀请");
    expect(outcome?.action).toEqual({
      label: "前往 GitHub 接受邀请",
      icon: "i-carbon-launch",
      href: GITHUB_INVITATION_URL,
      target: "_blank",
    });
  });

  it("cancelled 与 failed：只展示状态，不包含额外行动点", () => {
    const cancelled = parseSignInOutcome("cancelled");
    expect(cancelled).not.toBeNull();
    expect(cancelled?.type).toBe("info");
    expect(cancelled?.title).toBe("已取消登录");
    expect(cancelled?.action).toBeUndefined();

    const failed = parseSignInOutcome("failed");
    expect(failed).not.toBeNull();
    expect(failed?.type).toBe("warning");
    expect(failed?.title).toBe("登录没有完成");
    expect(failed?.action).toBeUndefined();
  });

  it("未知或非字符串参数：返回 null", () => {
    expect(parseSignInOutcome("unexpected_code")).toBeNull();
    expect(parseSignInOutcome(null)).toBeNull();
    expect(parseSignInOutcome(undefined)).toBeNull();
    expect(parseSignInOutcome(123)).toBeNull();
  });

  it("signInOutcomes 完整导出所有状态定义", () => {
    const outcomes = signInOutcomes();
    expect(Object.keys(outcomes)).toEqual(["not_member", "invite_pending", "cancelled", "failed"]);
  });
});
