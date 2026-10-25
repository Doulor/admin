import { afterEach, describe, expect, it } from "vitest";
import { PERMISSION_NODES } from "../../app/server/src/lib/permission-nodes";
import { actionText } from "../../app/console/src/lib/activity";
import { describeError } from "../../app/console/src/lib/errors";
import { ApiError } from "../../app/console/src/lib/http";
import { fmtDate, fmtDay } from "../../app/console/src/lib/format";
import { NODE_LABELS } from "../../app/console/src/lib/permission-nodes";
import { APPLICATION_STATUSES, statusMeta } from "../../app/console/src/lib/statuses";
import {
  applySwitchConfirm, applySwitchSaved, applySwitchView, emptyLetterDraft, letterErrors, letterPayload, letterPreviewBody, mailState, newestReviewId, noticePlan, reviewPatch, savedMessage,
  serverFieldErrors, statusChangedMessage, templateChoice,
  type LetterDraft,
} from "../../app/console/src/lib/applications";
import type { LetterTemplates, MailSettings, MailSummary } from "../../app/console/src/lib/types";

const ALL: MailSettings = { enabled: true, recipients: "all", deliverable: true };
const ALLOWLIST_MISS: MailSettings = { enabled: true, recipients: "allowlist", deliverable: false };
const OFF: MailSettings = { enabled: false, recipients: "all", deliverable: false };
const EMAIL = "zhou.zihan@example.test";
const draft = (patch: Partial<LetterDraft> = {}): LetterDraft => ({ ...emptyLetterDraft(), ...patch });
const mail = (patch: Partial<MailSummary>): MailSummary =>
  ({ status: "pending", skip_reason: null, attempts: 0, subject: "极客班面试安排", sent_at: null, updated_at: 0, ...patch });

describe("application statuses", () => {
  it("offers the five live statuses, with cancellation last", () => {
    expect(APPLICATION_STATUSES).toEqual(["received", "interview", "accepted", "rejected", "cancelled"]);
    expect(APPLICATION_STATUSES.map(id => statusMeta(id).label)).toEqual(["已收到", "待面试", "已录取", "未通过", "已取消"]);
  });

  it("still names the retired reviewing status in old history, and never throws on unknown ids", () => {
    expect(statusMeta("reviewing").label).toBe("评估中");
    expect(statusMeta("archived")).toEqual({ label: "archived", tone: "slate" });
    expect(statusMeta("constructor").label).toBe("constructor");
  });
});

describe("noticePlan", () => {
  it("says nothing while the status is unchanged", () => {
    expect(noticePlan("received", "received", true, ALL, EMAIL)).toEqual({ kind: "none" });
  });

  it("never mails when a status goes back to received", () => {
    expect(noticePlan("interview", "received", true, ALL, EMAIL)).toEqual({ kind: "back_to_received", hint: "改回已收到不发邮件。" });
  });

  it("never offers a letter when cancelling, regardless of mail settings or notify", () => {
    for (const settings of [ALL, ALLOWLIST_MISS, OFF]) {
      for (const notify of [true, false]) {
        expect(noticePlan("interview", "cancelled", notify, settings, EMAIL)).toEqual({
          kind: "cancelled", hint: "这份投递将标为已取消，不发邮件。简历和审核记录会保留。",
        });
      }
    }
    expect(noticePlan("cancelled", "cancelled", true, ALL, EMAIL)).toEqual({ kind: "none" });
  });

  it("names the recipient and the letter when the mail will go out", () => {
    expect(noticePlan("received", "interview", true, ALL, EMAIL)).toEqual({
      kind: "letter", letter: "interview", notify: true, sends: true, hint: `保存后给 ${EMAIL} 发「待面试」通知信。`,
    });
    expect(noticePlan("interview", "accepted", true, ALL, EMAIL)).toMatchObject({ sends: true, hint: `保存后给 ${EMAIL} 发「已录取」通知信。` });
    expect(noticePlan("received", "rejected", true, ALL, EMAIL)).toMatchObject({ sends: true, hint: `保存后给 ${EMAIL} 发「未通过」通知信。` });
  });

  it("explains why a letter will not go out", () => {
    expect(noticePlan("received", "interview", true, ALLOWLIST_MISS, EMAIL)).toMatchObject({ sends: false, hint: "当前只给白名单里的邮箱发信，这封不会发出。" });
    expect(noticePlan("received", "interview", true, OFF, EMAIL)).toMatchObject({ sends: false, hint: "发信还没有配置，这封不会发出。" });
    expect(noticePlan("received", "interview", false, ALL, EMAIL)).toMatchObject({ notify: false, sends: false, hint: "这次只改状态，不给投递人发邮件。" });
  });

  it("treats the retired reviewing status as a change like any other", () => {
    expect(noticePlan("reviewing", "received", true, ALL, EMAIL).kind).toBe("back_to_received");
    expect(noticePlan("reviewing", "interview", true, ALL, EMAIL).kind).toBe("letter");
  });
});

describe("letter fields", () => {
  it("requires the interview time and place, and nothing else", () => {
    expect(letterErrors("interview", draft({ time: "  ", place: "" }))).toEqual({ time: "请填面试时间。", place: "请填面试地点。" });
    expect(letterErrors("interview", draft({ time: "9 月 30 日（周三）19:00", place: "东校区三教 301" }))).toEqual({});
    expect(letterErrors("accepted", draft())).toEqual({});
    expect(letterErrors("rejected", draft())).toEqual({});
  });

  it("applies the server's length limits", () => {
    expect(letterErrors("interview", draft({ time: "x".repeat(61), place: "y".repeat(121), interviewNotes: "z".repeat(1001) }))).toEqual({
      time: "面试时间最多 60 个字。", place: "面试地点最多 120 个字。", notes: "面试说明最多 1000 个字。",
    });
    expect(letterErrors("interview", draft({ time: "x".repeat(60), place: "y".repeat(120), interviewNotes: "z".repeat(1000) }))).toEqual({});
    expect(letterErrors("accepted", draft({ acceptedNotes: "z".repeat(1001) }))).toEqual({ notes: "最多 1000 个字。" });
    expect(letterErrors("rejected", draft({ message: "z".repeat(1001) }))).toEqual({ message: "最多 1000 个字。" });
  });

  it("sends only the fields of the letter being written, trimmed, without empty optional ones", () => {
    const filled = draft({ time: " 19:00 ", place: " 三教 ", interviewNotes: " 带学生证\n带电脑 ", acceptedNotes: "进群", message: "谢谢" });
    expect(letterPayload("interview", filled)).toEqual({ time: "19:00", place: "三教", notes: "带学生证\n带电脑" });
    expect(letterPayload("interview", draft({ time: "19:00", place: "三教" }))).toEqual({ time: "19:00", place: "三教" });
    expect(letterPayload("accepted", filled)).toEqual({ notes: "进群" });
    expect(letterPayload("accepted", draft())).toEqual({});
    expect(letterPayload("rejected", filled)).toEqual({ message: "谢谢" });
  });
});

describe("newestReviewId", () => {
  it("takes the largest id, not the first row, and 0 when there are none", () => {
    // 时钟往回拨过：按时间排第一的是 16，最新写进去的是 18
    expect(newestReviewId([{ id: 16 }, { id: 18 }, { id: 15 }])).toBe(18);
    expect(newestReviewId([])).toBe(0);
  });
});

describe("reviewPatch", () => {
  const letter = draft({ time: "19:00", place: "三教" });

  it("sends notify and the letter when the status changes to one that mails", () => {
    expect(reviewPatch({ latestReviewId: 3, current: "received", status: "interview", note: " 内部备注 ", notify: true, draft: letter })).toEqual({
      expected_status: "received", expected_review_id: 3, status: "interview", note: "内部备注", notify: true, letter: { time: "19:00", place: "三教" },
    });
  });

  it("sends notify:false and no letter when the reviewer unticks the mail", () => {
    expect(reviewPatch({ latestReviewId: 3, current: "received", status: "interview", note: "", notify: false, draft: letter })).toEqual({ expected_status: "received", expected_review_id: 3, status: "interview", notify: false });
  });

  it("sends neither notify nor a letter for going back to received or a note only", () => {
    expect(reviewPatch({ latestReviewId: 3, current: "interview", status: "received", note: "", notify: true, draft: letter })).toEqual({ expected_status: "interview", expected_review_id: 3, status: "received" });
    expect(reviewPatch({ latestReviewId: 3, current: "interview", status: "interview", note: "改到周五", notify: true, draft: letter })).toEqual({ expected_status: "interview", expected_review_id: 3, note: "改到周五" });
  });

  it("sends cancellation without a letter, and keeps cancelled in the page version", () => {
    expect(reviewPatch({ latestReviewId: 3, current: "interview", status: "cancelled", note: " 已撤回 ", notify: true, draft: letter })).toEqual({
      expected_status: "interview", expected_review_id: 3, status: "cancelled", note: "已撤回",
    });
    expect(reviewPatch({ latestReviewId: 4, current: "cancelled", status: "cancelled", note: "补充说明", notify: true, draft: letter })).toEqual({
      expected_status: "cancelled", expected_review_id: 4, note: "补充说明",
    });
    expect(reviewPatch({ latestReviewId: 4, current: "cancelled", status: "received", note: "", notify: true, draft: letter })).toEqual({
      expected_status: "cancelled", expected_review_id: 4, status: "received",
    });
  });

  it("always sends the status and the latest review the page shows, except for a retired status the server would refuse", () => {
    expect(reviewPatch({ latestReviewId: 0, current: "accepted", status: "rejected", note: "", notify: false, draft: letter })).toMatchObject({ expected_status: "accepted", expected_review_id: 0 });
    expect(reviewPatch({ latestReviewId: 3, current: "reviewing", status: "received", note: "", notify: true, draft: letter })).toEqual({ status: "received" });
  });

  it("sends template_id only for a template other than the default of that kind (#285)", () => {
    const base = { latestReviewId: 3, current: "received", status: "interview" as const, note: "", notify: true, draft: letter };
    expect(reviewPatch({ ...base, templateId: "interview-short", defaultTemplateId: "default-interview" })).toEqual({
      expected_status: "received", expected_review_id: 3, status: "interview", notify: true, template_id: "interview-short", letter: { time: "19:00", place: "三教" },
    });
    expect(reviewPatch({ ...base, templateId: "default-interview", defaultTemplateId: "default-interview" })).not.toHaveProperty("template_id");
    expect(reviewPatch({ ...base })).not.toHaveProperty("template_id");
    expect(reviewPatch({ ...base, templateId: "", defaultTemplateId: "default-interview" })).not.toHaveProperty("template_id");
  });

  it("does not send a template when no letter goes out, or when the status does not mail", () => {
    const pick = { templateId: "interview-short", defaultTemplateId: "default-interview" };
    expect(reviewPatch({ latestReviewId: 3, current: "received", status: "interview", note: "", notify: false, draft: letter, ...pick })).not.toHaveProperty("template_id");
    expect(reviewPatch({ latestReviewId: 3, current: "interview", status: "cancelled", note: "", notify: true, draft: letter, ...pick })).not.toHaveProperty("template_id");
    expect(reviewPatch({ latestReviewId: 3, current: "interview", status: "interview", note: "改到周五", notify: true, draft: letter, ...pick })).not.toHaveProperty("template_id");
  });
});

describe("templateChoice (#285)", () => {
  const templates: LetterTemplates = {
    interview: [{ id: "default-interview", name: "默认", is_default: true }, { id: "interview-short", name: "面试邀请 · 简短", is_default: false }],
    accepted: [{ id: "default-accepted", name: "默认", is_default: true }],
    rejected: [{ id: "r-a", name: "未通过 · 温和", is_default: false }, { id: "r-b", name: "未通过 · 简短", is_default: true }],
  };

  it("offers no choice while a kind has only one enabled template, or the page has none", () => {
    expect(templateChoice(templates, "accepted")).toBeNull();
    expect(templateChoice(undefined, "interview")).toBeNull();
    expect(templateChoice({ interview: [], accepted: [], rejected: [] }, "interview")).toBeNull();
  });

  it("lists the templates of the kind, names the default one, and remembers which it is", () => {
    expect(templateChoice(templates, "interview")).toEqual({
      defaultId: "default-interview",
      options: [{ value: "default-interview", label: "默认" }, { value: "interview-short", label: "面试邀请 · 简短" }],
    });
    expect(templateChoice(templates, "rejected")).toEqual({
      defaultId: "r-b",
      options: [{ value: "r-a", label: "未通过 · 温和" }, { value: "r-b", label: "未通过 · 简短（默认）" }],
    });
  });

  it("falls back to the first template when the list somehow carries no default", () => {
    const choice = templateChoice({ interview: [{ id: "a", name: "甲", is_default: false }, { id: "b", name: "乙", is_default: false }], accepted: [], rejected: [] }, "interview");
    expect(choice?.defaultId).toBe("a");
  });
});

describe("letterPreviewBody (#285)", () => {
  it("sends the status and the letter fields that are filled in, and leaves the blank ones out", () => {
    expect(letterPreviewBody({ status: "interview", draft: draft({ time: " 19:00 ", place: "", interviewNotes: "" }) })).toEqual({ status: "interview", letter: { time: "19:00" } });
    expect(letterPreviewBody({ status: "interview", draft: draft() })).toEqual({ status: "interview", letter: {} });
    expect(letterPreviewBody({ status: "accepted", draft: draft({ time: "19:00", acceptedNotes: "进群" }) })).toEqual({ status: "accepted", letter: { notes: "进群" } });
    expect(letterPreviewBody({ status: "rejected", draft: draft({ message: "谢谢" }) })).toEqual({ status: "rejected", letter: { message: "谢谢" } });
  });

  it("names the template only when it is not the default of the kind", () => {
    expect(letterPreviewBody({ status: "interview", draft: draft(), templateId: "interview-short", defaultTemplateId: "default-interview" })).toEqual({
      status: "interview", template_id: "interview-short", letter: {},
    });
    expect(letterPreviewBody({ status: "interview", draft: draft(), templateId: "default-interview", defaultTemplateId: "default-interview" })).not.toHaveProperty("template_id");
  });
});

describe("statusChangedMessage", () => {
  it("reads the server's 409 status_changed and nothing else", () => {
    const message = "这份投递刚被别人处理过，现在是「已录取」，看过最新的记录再改";
    expect(statusChangedMessage(new ApiError(409, "status_changed", message))).toBe(message);
    expect(statusChangedMessage(new ApiError(409, "status_changed", ""))).toBe("这份投递刚被别人处理过，看过最新的记录再改。");
    expect(statusChangedMessage(new ApiError(409, "invitation_exists", "x"))).toBeNull();
    expect(statusChangedMessage(new ApiError(400, "status_changed", "x"))).toBeNull();
    expect(statusChangedMessage(new Error("offline"))).toBeNull();
  });
});

describe("serverFieldErrors", () => {
  const error = (code: string, payload: Record<string, unknown>, message = "") => new ApiError(400, code, message, undefined, { error: code, ...payload });

  it("puts letter_required on the interview time and place", () => {
    expect(serverFieldErrors(error("letter_required", { fields: { time: "请填面试时间", place: "请填面试地点" } }))).toEqual({ letter: { time: "请填面试时间", place: "请填面试地点" } });
    expect(serverFieldErrors(error("letter_required", { fields: { place: true } }))).toEqual({ letter: { place: "请填面试地点。" } });
  });

  it("puts invalid_status on the status select", () => {
    expect(serverFieldErrors(error("invalid_status", {}, "状态只能是已收到、待面试、已录取、未通过、已取消"))).toEqual({ status: "状态只能是已收到、待面试、已录取、未通过、已取消", letter: {} });
    expect(serverFieldErrors(error("invalid_status", {}))?.status).toContain("已取消");
  });

  it("puts letter_invalid in the notice section, since it names no single field", () => {
    const message = "现在没有配置回信地址，信里不能请对方直接回复这封邮件，换个说法";
    expect(serverFieldErrors(error("letter_invalid", {}, message))).toEqual({ notice: message, letter: {} });
  });

  it("puts template_invalid, a template that is gone, of another kind or disabled, in the notice section too (#285)", () => {
    expect(serverFieldErrors(error("template_invalid", {}, "选的这套信不是待面试的"))).toEqual({ notice: "选的这套信不是待面试的", letter: {} });
    expect(serverFieldErrors(error("template_invalid", {}))?.notice).toContain("换一套");
  });

  it("leaves every other error to the alert", () => {
    expect(serverFieldErrors(error("letter_required", {}))).toBeNull();
    expect(serverFieldErrors(error("validation_error", {}))).toBeNull();
    expect(serverFieldErrors(new ApiError(501, "mock_read_only", "开发预览是只读的"))).toBeNull();
    expect(serverFieldErrors(new Error("offline"))).toBeNull();
  });
});

describe("mailState", () => {
  it("describes every state of a letter in plain words", () => {
    const sentAt = Date.UTC(2026, 8, 27, 3, 2);
    expect(mailState(mail({ status: "sent", attempts: 1, sent_at: sentAt }))).toEqual({ text: "已发出（2026/09/27 11:02）", tone: "success" });
    expect(mailState(mail({ status: "pending" })).text).toBe("正在发");
    expect(mailState(mail({ status: "sending", attempts: 1 })).text).toBe("正在发");
    expect(mailState(mail({ status: "pending", attempts: 2 }))).toEqual({ text: "发送失败，等待第 2 次重试", tone: "warning" });
    expect(mailState(mail({ status: "failed", attempts: 6 }))).toEqual({ text: "没有发出：发了 6 次都失败了", tone: "danger" });
    expect(mailState(mail({ status: "skipped", skip_reason: "not_allowlisted" })).text).toBe("未发送（不在白名单）");
    expect(mailState(mail({ status: "skipped", skip_reason: "mail_disabled" })).text).toBe("没有发：发信还没有配置");
    expect(mailState(mail({ status: "skipped", skip_reason: "recipient_limited" })).text).toBe("没有发：24 小时内已经给这个邮箱发过确认信");
    expect(mailState(mail({ status: "skipped", skip_reason: "rate_limited" })).text).toBe("没有发：这一小时发出的确认信已到上限");
    expect(mailState(mail({ status: "skipped", skip_reason: "source_limited" })).text).toBe("没有发：同一个网络这段时间投递得太多");
    expect(mailState(null)).toEqual({ text: "没有发", tone: "muted" });
  });

  it("does not throw on a state it does not know", () => {
    expect(mailState(mail({ status: "bounced" as MailSummary["status"] })).text).toBe("bounced");
    expect(mailState(mail({ status: "skipped", skip_reason: "quota" })).text).toBe("没有发：quota");
  });

  it("tells the reviewer what happened to the letter after saving", () => {
    expect(savedMessage(null)).toBe("审核记录已更新。");
    expect(savedMessage(null, "cancelled")).toBe("投递已取消，没有发送邮件。");
    expect(savedMessage(mail({ status: "pending" }))).toBe("通知信正在发，结果记在审核记录里。");
    expect(savedMessage(mail({ status: "skipped", skip_reason: "not_allowlisted" }))).toBe("这封信没有发出：当前只给白名单里的邮箱发信。");
    expect(savedMessage(mail({ status: "skipped", skip_reason: "mail_disabled" }))).toBe("这封信没有发出：发信还没有配置。");
  });
});

describe("console times are Beijing time", () => {
  const original = process.env.TZ;
  afterEach(() => {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  });

  it("formats the same instant the same way whatever the machine's time zone is", () => {
    // 北京时间 9 月 27 日 01:05 = UTC 9 月 26 日 17:05：跨了日期，时区不对一眼就能看出来。
    const instant = Date.UTC(2026, 8, 26, 17, 5);
    for (const zone of ["UTC", "America/Los_Angeles", "Asia/Shanghai"]) {
      process.env.TZ = zone;
      expect(fmtDate(instant), zone).toBe("2026/09/27 01:05");
      expect(fmtDay(instant), zone).toBe("2026/09/27");
    }
  });
});

describe("招新总开关（#284）", () => {
  it("says open or closed and what that means for the website; the last change only shows once there was one", () => {
    expect(applySwitchView({ open: true, updated_at: null })).toEqual({
      title: "招新投递：开放中", hint: "官网「加入我们」窗口可以投递。", changed: null,
    });
    const closedAt = Date.UTC(2026, 9, 25, 4, 30);
    expect(applySwitchView({ open: false, updated_at: closedAt })).toEqual({
      title: "招新投递：已关闭",
      hint: "官网「加入我们」窗口显示招新暂未开放，新的投递会被拒绝。已经收到的投递照常处理。",
      changed: `上次改动：${fmtDate(closedAt)}`,
    });
  });

  it("asks before closing as a risky action and before reopening as a plain one, with different buttons", () => {
    const close = applySwitchConfirm(false);
    const open = applySwitchConfirm(true);
    expect(close).toMatchObject({ title: "关闭招新？", confirmText: "关闭招新", danger: true });
    expect(open).toMatchObject({ title: "重新开放招新？", confirmText: "开放招新" });
    expect(open.danger).toBeFalsy();
    // 关闭时要让人知道已经收到的投递不受影响；重新开放时要说明每日限制没变
    expect(close.body).toContain("已经收到的投递和审核不受影响");
    expect(open.body).toContain("每天能投几份的限制不变");
  });

  it("tells the admin the website picks the new state up when the window is opened again", () => {
    expect(applySwitchSaved(false)).toBe("已关闭招新，官网「加入我们」窗口重新打开后显示招新暂未开放");
    expect(applySwitchSaved(true)).toBe("已开放招新，官网「加入我们」窗口重新打开后可以投递");
  });

  it("names the node for someone who lacks it, and labels the audit actions the switch leaves", () => {
    const refused = new ApiError(403, "forbidden", "", undefined, { error: "forbidden", node: "apply.settings" });
    expect(describeError(refused).title).toBe("没有「招新开关」权限");
    expect(actionText("application.settings.update")).toBe("开放或关闭招新");
    // 关闭期间被拒的投递由 http-policy 记成 http.apply_closed，操作记录里要看得懂
    expect(actionText("http.apply_closed")).toBe("投递被拒（招新已关闭）");
  });

  it("keeps a local name for every permission node the server defines, so a refusal never shows a raw node id", () => {
    const unnamed = PERMISSION_NODES.filter(def => !def.deprecated && !NODE_LABELS[def.node]).map(def => def.node);
    expect(unnamed).toEqual([]);
  });
});
