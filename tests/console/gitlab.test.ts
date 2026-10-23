import { describe, expect, it } from "vitest";
import { accessText, actionText, canSyncNow, errorText, gitlabNote, pendingText, profileUrl, stateText, usernameOf } from "../../app/console/src/lib/gitlab";
import type { GitlabAccount, GitlabAccountsResponse } from "../../app/console/src/lib/types";
import { mockGitlab } from "../../app/console/src/mock/console";
import { consoleContracts } from "../../app/server/src/routes/console/contracts";

const account = (patch: Partial<GitlabAccount> = {}): GitlabAccount => ({
  account_id: "01JTESTACCOUNT000000000001", login: "alice", username: "alice", gitlab_user_id: 7, state: "active", access_level: 30,
  last_error: null, last_error_at: null, synced_at: 1, pending: [], ...patch,
});
const data = (patch: Partial<GitlabAccountsResponse> = {}): GitlabAccountsResponse => ({
  mode: "on", gitlab_url: "https://git.example.test", group: "geek", client_registered: true, accounts: [], ...patch,
});

describe("GitLab column on the people page (#270)", () => {
  it("names the group access the sync gives and the actions still to do", () => {
    expect([accessText(30), accessText(50), accessText(35)]).toEqual(["开发者", "所有者", "权限 35"]);
    expect(actionText({ kind: "create", username: "alice", access_level: 30 })).toBe("建号，进组当开发者");
    expect(actionText({ kind: "set_access", access_level: 50 })).toBe("组权限改成所有者");
    expect(actionText({ kind: "find_and_block" })).toBe("按身份找到 GitLab 用户并封禁");
    expect(actionText({ kind: "set_avatar" })).toBe("传头像");
    expect(pendingText("dry-run", [{ kind: "create", username: "alice", access_level: 30 }, { kind: "set_avatar" }])).toBe("预演：建号，进组当开发者、传头像");
    expect(pendingText("dry-run", [{ kind: "create", username: "alice", access_level: 30 }])).toBe("预演：建号，进组当开发者");
    expect(pendingText("on", [{ kind: "unblock" }, { kind: "set_access", access_level: 30 }])).toBe("待同步：解封、组权限改成开发者");
    expect(pendingText("on", [])).toBe("");
    expect(pendingText("off", [{ kind: "block" }])).toBe("");
  });

  it("explains every failure code the server records, with its HTTP status", () => {
    expect(errorText("gitlab_unreachable")).toBe("连不上 GitLab");
    expect(errorText("gitlab_client_missing")).toBe("签发者里没有 GitLab 客户端");
    expect(errorText("gitlab_username_exhausted")).toBe("用户名都被占用了");
    expect(errorText("gitlab_create_409")).toBe("建号被拒（409）");
    expect(errorText("gitlab_member_500")).toBe("进组失败（500）");
    expect(errorText("gitlab_lookup_403")).toBe("查找失败（403）");
    expect(errorText("gitlab_block_403")).toBe("封禁失败（403）");
    expect(errorText("gitlab_unblock_404")).toBe("解封失败（404）");
    expect(errorText("gitlab_sync_failed")).toBe("同步出错");
    expect(errorText("gitlab_avatar_400")).toBe("头像被拒（400）");
    expect(errorText("github_avatar_503")).toBe("GitHub 头像下载失败（503）");
    expect(errorText("github_avatar_unreachable")).toBe("连不上 GitHub 头像");
    expect(errorText("something_new")).toBe("something_new");
  });

  it("describes the GitLab user and links to it only once it exists", () => {
    expect(stateText(account())).toBe("开发者");
    expect(stateText(account({ access_level: 50 }))).toBe("所有者");
    expect(stateText(account({ state: "blocked" }))).toBe("已封禁");
    expect(stateText(account({ access_level: null }))).toBe("还没进组");
    expect(stateText(account({ gitlab_user_id: null, state: "pending", access_level: null }))).toBe("建号没完成");
    expect(stateText(account({ username: null, gitlab_user_id: null, state: null, access_level: null }))).toBe("没有 GitLab 账号");
    // 还没建号的：显示建号会用的用户名，状态由「还要做的事」说明
    const planned = account({ username: null, gitlab_user_id: null, state: null, access_level: null, pending: [{ kind: "create", username: "alice_yz", access_level: 30 }] });
    expect([usernameOf(planned), stateText(planned)]).toEqual(["alice_yz", ""]);
    expect(usernameOf(account({ username: null, pending: [{ kind: "find_and_block" }] }))).toBeNull();
    expect(profileUrl(data(), account())).toBe("https://git.example.test/alice");
    expect(profileUrl(data(), account({ gitlab_user_id: null }))).toBeNull();
    expect(profileUrl(data({ gitlab_url: null }), account())).toBeNull();
  });

  it("offers a manual sync only when it can do something", () => {
    const failed = account({ last_error: "gitlab_member_500", pending: [{ kind: "set_access", access_level: 30 }] });
    expect(canSyncNow(data(), failed)).toBe(true);
    expect(canSyncNow(data(), account({ username: null, gitlab_user_id: null, state: null, pending: [{ kind: "create", username: "alice", access_level: 30 }] }))).toBe(true);
    expect(canSyncNow(data(), account())).toBe(false);
    expect(canSyncNow(data({ mode: "dry-run" }), failed)).toBe(false);
    expect(canSyncNow(data({ client_registered: false }), failed)).toBe(false);
  });

  it("says above the list when sync is off, rehearsing or missing its client", () => {
    expect(gitlabNote(data({ mode: "off" }))).toBe("GitLab 同步没有打开，名单里不显示 GitLab 账号。");
    expect(gitlabNote(data({ mode: "dry-run" }))).toContain("不改 geek 组");
    expect(gitlabNote(data({ client_registered: false }))).toContain("client id 为 gitlab");
    expect(gitlabNote(data())).toBe("");
  });

  it("keeps the preview samples in the server's shape and shows every state", () => {
    type Schema = { required: string[]; properties: Record<string, { items?: Schema } & Partial<Schema>> };
    const schema = (consoleContracts["GET /api/console/gitlab/accounts"].response as Record<number, Schema>)[200];
    const item = schema.properties.accounts.items!;
    for (const which of ["on", "dry-run", "unregistered", "off"] as const) {
      const sample = mockGitlab(which);
      expect(Object.keys(sample).sort(), which).toEqual([...schema.required].sort());
      for (const row of sample.accounts) expect(Object.keys(row).sort(), `${which} ${row.login}`).toEqual([...item.required].sort());
    }
    const on = mockGitlab("on");
    expect(on.accounts.some(row => row.last_error && canSyncNow(on, row))).toBe(true);
    expect(on.accounts.some(row => row.state === "blocked")).toBe(true);
    expect(on.accounts.some(row => row.access_level === 50)).toBe(true);
    expect(on.accounts.some(row => row.last_error === "gitlab_avatar_400" && row.pending.some(action => action.kind === "set_avatar"))).toBe(true);
    expect(mockGitlab("dry-run").accounts.every(row => row.username === null)).toBe(true);
    expect(gitlabNote(mockGitlab("unregistered"))).toContain("client id 为 gitlab");
    expect(mockGitlab("off").accounts.every(row => row.pending.length === 0)).toBe(true);
  });
});
