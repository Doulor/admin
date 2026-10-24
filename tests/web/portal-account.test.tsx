// @vitest-environment jsdom
// 官网读 /auth/me（#273）：账号还没有登录邮箱时整页跳到绑定邮箱页，带上当前地址，不当成已登录的账号显示；其余情况照常。
// jsdom 改不了 window.location.assign，所以把 osApps 的 followAppLink 换成记录调用的假函数（同 portal-os-entries.test.tsx）。
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { AppLink } from "../../app/web/sites/portal/lib/osApps";

const followed = vi.hoisted(() => ({ calls: [] as AppLink[] }));
vi.mock("../../app/web/sites/portal/lib/osApps", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../app/web/sites/portal/lib/osApps")>();
  return { ...actual, followAppLink: (link: AppLink) => followed.calls.push(link) };
});

import { useAccount } from "../../app/web/sites/portal/lib/account";

function me(body: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } })));
}

afterEach(() => {
  vi.unstubAllGlobals();
  followed.calls = [];
  window.history.replaceState(null, "", "/");
});

it("账号还没有登录邮箱：跳到绑定邮箱页并带上当前地址，不显示成已登录", async () => {
  window.history.replaceState(null, "", "/competitions/7?tab=teams#me");
  me({ signed_in: true, login: "ada", avatar_url: null, account_id: "acc-1", console_link: false, email_required: true });
  const { result } = renderHook(() => useAccount());
  await waitFor(() => expect(followed.calls).toEqual([{ href: "/bind-email?return_to=%2Fcompetitions%2F7%3Ftab%3Dteams%23me", newTab: false }]));
  expect(result.current).toMatchObject({ account: null, loaded: false });
});

it("缺真实姓名或年级（#280）：跳到补资料页并带上当前地址；邮箱也缺时先去绑邮箱", async () => {
  window.history.replaceState(null, "", "/forum/t/3?page=2");
  me({ signed_in: true, login: "ada", avatar_url: null, account_id: "acc-1", console_link: false, email_required: false, profile_required: true });
  const first = renderHook(() => useAccount());
  await waitFor(() => expect(followed.calls).toEqual([{ href: "/complete-profile?return_to=%2Fforum%2Ft%2F3%3Fpage%3D2", newTab: false }]));
  expect(first.result.current).toMatchObject({ account: null, loaded: false });

  followed.calls = [];
  me({ signed_in: true, login: "ada", avatar_url: null, account_id: "acc-1", console_link: false, email_required: true, profile_required: true });
  renderHook(() => useAccount());
  await waitFor(() => expect(followed.calls).toEqual([{ href: "/bind-email?return_to=%2Fforum%2Ft%2F3%3Fpage%3D2", newTab: false }]));
});

it("已经有登录邮箱或没登录：不跳，照常显示", async () => {
  me({ signed_in: true, login: "ada", avatar_url: null, account_id: "acc-1", console_link: false, email_required: false });
  const signedIn = renderHook(() => useAccount());
  await waitFor(() => expect(signedIn.result.current.loaded).toBe(true));
  expect(signedIn.result.current.account).toMatchObject({ login: "ada", accountId: "acc-1" });

  me({ signed_in: false });
  const signedOut = renderHook(() => useAccount());
  await waitFor(() => expect(signedOut.result.current.loaded).toBe(true));
  expect(signedOut.result.current.account).toBeNull();
  expect(followed.calls).toEqual([]);
});
