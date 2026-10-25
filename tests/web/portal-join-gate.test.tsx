// @vitest-environment jsdom
// 「加入我们」窗口要登录才能投（#274 / #279）：没登录时信纸上只有「先注册再投递」，注册或登录后回到 /?open=join（桌面打开这个窗口）；
// 登录后信纸底部写今天还能投几份（/auth/me 的 quota，成员不限时不写），投完了按钮变灰；
// 寄出后用回执里的新限额，写到一半登录失效（401）换成「重新登录」，被每日限额挡下（429 apply.daily）照服务端的话说。
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PROMO_COOKIE } from "../../app/web/sites/portal/lib/promo";

import JoinBox from "../../app/web/sites/portal/components/os/JoinBox";

type Reply = { status: number; body: unknown };
let me: unknown = { signed_in: false };
let apply: Reply = { status: 201, body: {} };
const posts: unknown[] = [];

const json = ({ status, body }: Reply) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const signedIn = (quota: unknown) => ({ signed_in: true, login: "newbie", account_id: "acc_1", level: "registered", permissions: ["apply.submit"], quota });

beforeEach(() => {
  me = { signed_in: false };
  apply = { status: 201, body: {} };
  posts.length = 0;
  document.cookie = `${PROMO_COOKIE}=1; Path=/`;
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/auth/me") return json({ status: 200, body: me });
      if (url === "/api/public/config") return json({ status: 200, body: { turnstile_site_key: null, pow_difficulty: 1 } });
      if (url === "/api/portal/apply") {
        posts.push(JSON.parse(String(init?.body)));
        return json(apply);
      }
      return json({ status: 404, body: { error: "not_found" } });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.cookie = `${PROMO_COOKIE}=; Max-Age=0; Path=/`;
});

const open = () => render(<JoinBox />);
const submitButton = () => screen.getByRole("button", { name: /寄出这封信/ }) as HTMLButtonElement;

function fillLetter() {
  fireEvent.change(screen.getByRole("textbox", { name: "姓名" }), { target: { value: "张同学" } });
  fireEvent.change(screen.getByRole("textbox", { name: "班级" }), { target: { value: "计科 2301 班" } });
  fireEvent.change(screen.getByRole("textbox", { name: /邮箱/ }), { target: { value: "zhang@example.com" } });
  fireEvent.change(screen.getByRole("textbox", { name: /你会什么/ }), { target: { value: "写过一个课程表小程序，想学编译器。" } });
}

it("没登录：信纸上只有「先注册再投递」，注册和登录都回到 /?open=join，没有表单也没有寄出按钮", async () => {
  open();
  expect(await screen.findByRole("heading", { name: "先注册再投递" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "注册" }).getAttribute("href")).toBe("/signin?return_to=%2F%3Fopen%3Djoin&tab=register");
  expect(screen.getByRole("link", { name: "登录" }).getAttribute("href")).toBe("/signin?return_to=%2F%3Fopen%3Djoin");
  expect(screen.queryByRole("textbox", { name: "姓名" })).toBeNull();
  expect(screen.queryByRole("button", { name: /寄出这封信/ })).toBeNull();
});

it("注册用户：写今天还能投几份；寄出后换成回执里的新限额", async () => {
  me = signedIn({ apply_left_today: 2, apply_daily_limit: 3 });
  apply = { status: 201, body: { id: "app_1", submitted_at: Date.now(), message: "收到了", quota: { apply_left_today: 1, apply_daily_limit: 3 } } };
  const view = open();
  await waitFor(() => expect(view.container.querySelector(".pt-joinbox-quota")?.textContent).toBe("今天还能投 2 份"));
  expect(screen.queryByRole("heading", { name: "先注册再投递" })).toBeNull();
  expect(submitButton().disabled).toBe(false);

  fillLetter();
  fireEvent.click(submitButton());
  expect(await screen.findByText("信收到了")).toBeTruthy();
  expect(posts).toHaveLength(1);
  expect(view.container.querySelector(".pt-joinbox-quota")?.textContent).toBe("今天还能投 1 份");
});

it("今天投完了：按钮变灰，写明天再来；成员不限时不写份数", async () => {
  me = signedIn({ apply_left_today: 0, apply_daily_limit: 3 });
  const view = open();
  await waitFor(() => expect(view.container.querySelector(".pt-joinbox-quota")?.textContent).toBe("今天的投递次数用完了，明天再来"));
  expect(submitButton().disabled).toBe(true);
  view.unmount();

  me = signedIn({ apply_left_today: -1, apply_daily_limit: -1 });
  const member = open();
  await waitFor(() => expect(screen.getByRole("textbox", { name: "姓名" })).toBeTruthy());
  await new Promise((done) => setTimeout(done, 0));
  expect(member.container.querySelector(".pt-joinbox-quota")).toBeNull();
  expect(submitButton().disabled).toBe(false);
});

it("写到一半登录失效（401）：信纸留着，按钮换成重新登录", async () => {
  me = signedIn({ apply_left_today: 2, apply_daily_limit: 3 });
  apply = { status: 401, body: { error: "unauthenticated", message: "请先登录" } };
  const view = open();
  await waitFor(() => expect(view.container.querySelector(".pt-joinbox-quota")).not.toBeNull());
  fillLetter();
  fireEvent.click(submitButton());
  const again = await screen.findByRole("link", { name: "重新登录" });
  expect(again.getAttribute("href")).toBe("/signin?return_to=%2F%3Fopen%3Djoin");
  expect(screen.getByRole("alert").textContent).toContain("登录已经失效");
  expect((screen.getByRole("textbox", { name: "姓名" }) as HTMLInputElement).value).toBe("张同学");
  expect(screen.queryByRole("button", { name: /寄出这封信/ })).toBeNull();
});

it("被每日限额挡下（429 apply.daily）：照服务端的话说，按钮变灰", async () => {
  me = signedIn({ apply_left_today: 1, apply_daily_limit: 3 });
  apply = { status: 429, body: { error: "rate_limited", bucket: "apply.daily", message: "今天已经投了 3 份，明天再来", retry_after: 3600 } };
  const view = open();
  await waitFor(() => expect(view.container.querySelector(".pt-joinbox-quota")).not.toBeNull());
  fillLetter();
  fireEvent.click(submitButton());
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("今天已经投了 3 份，明天再来"));
  expect(submitButton().disabled).toBe(true);
  expect(view.container.querySelector(".pt-joinbox-quota")?.textContent).toBe("今天的投递次数用完了，明天再来");
});
