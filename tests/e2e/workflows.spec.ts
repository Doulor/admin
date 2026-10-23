import { expect, test, type Page } from "@playwright/test";
import { CONSOLE_ORIGIN, SLOW } from "../../playwright.config";

test.beforeEach(async ({ page }) => {
  // No browser test may contact an external service or a business API.
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1" && url.protocol !== "data:") return route.abort();
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "unexpected_live_request_in_test" }) });
    return route.continue();
  });
});

/** 控制台开发预览：样板数据（只读、全部虚构）+ 指定身份。 */
async function openConsole(page: Page, path: string, persona = "owner") {
  const url = new URL(path, CONSOLE_ORIGIN);
  url.searchParams.set("__data", "mock");
  url.searchParams.set("__persona", persona);
  await page.goto(url.toString());
}

test("public docs have usable labels/language switching; no 控制台 link for a visitor", async ({ page }) => {
  const me = page.waitForResponse(response => new URL(response.url()).pathname === "/auth/me");
  await page.goto("/sites/portal/docs");
  await me;
  await expect(page.getByRole("link", { name: "使用指南", exact: true })).toBeVisible();
  // 开发态右上角固定的「DEV CONTROL」浮层盖住了这个按钮（官网既有问题，与控制台无关），用键盘触发同一个按钮。
  const english = page.getByRole("button", { name: "English", exact: true });
  await english.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/docs\/usage-en/);
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "论坛", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "控制台", exact: true })).toHaveCount(0);
});

test("the page footer links 控制台 only when /auth/me says console_link", async ({ page }) => {
  for (const consoleLink of [false, true]) {
    await page.route("**/auth/me", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ signed_in: true, login: "ada", user_id: 1, avatar_url: null, console_link: consoleLink }) }));
    const me = page.waitForResponse(response => new URL(response.url()).pathname === "/auth/me");
    await page.goto("/sites/portal/docs");
    await me;
    const link = page.getByRole("contentinfo").getByRole("link", { name: "控制台", exact: true });
    if (consoleLink) await expect(link).toHaveAttribute("href", "/sites/admin/console");
    else await expect(link).toHaveCount(0);
    await page.unroute("**/auth/me");
  }
});

test("portal forum entry targets the adopted Nuxt module, not the retired React page", async ({ page }) => {
  await page.goto("/sites/portal/docs");
  const navigationLink = page.getByRole("navigation", { name: "主导航" }).getByRole("link", { name: "论坛", exact: true });
  const footerLink = page.getByRole("contentinfo").getByRole("link", { name: "论坛", exact: true });
  await expect(navigationLink).toHaveAttribute("href", "http://127.0.0.1:3456/");
  await expect(footerLink).toHaveAttribute("href", "http://127.0.0.1:3456/");
});

test("legacy /apply redirects to the join-us letter", async ({ page }) => {
  await page.goto("/sites/portal/apply");
  await expect(page).toHaveURL(/\/sites\/portal\/join-us$/);
  await expect(page.getByRole("heading", { level: 1, name: "加入我们" })).toBeVisible();
  // 信纸在信封打开后才对辅助技术可见（此前 aria-hidden），给 3D 入场动画留足时间。
  await expect(page.getByRole("heading", { name: "致 长江大学极客班：" })).toBeVisible({ timeout: 15_000 * SLOW });
});

const PROMO_CDN = "https://cdn.crosery.com/yzgc/static/promo/**";

test("first visit to join-us never gets stuck behind the promo: whatever the player does, the letter opens", async ({ page }) => {
  // beforeEach 已经拦掉所有外部请求：能播就加载失败，播不了就直接放行，两种都必须进到信纸。
  await page.goto("/sites/portal/join-us");
  await expect(page.getByRole("heading", { name: "致 长江大学极客班：" })).toBeVisible({ timeout: 15_000 * SLOW });
  await expect(page.getByRole("dialog", { name: "极客班宣传片" })).toHaveCount(0);
});

test("the promo can be skipped on the first visit and does not autoplay again", async ({ page, context }) => {
  await page.goto("/sites/portal/docs");
  const canPlay = await page.evaluate(() => typeof MediaSource !== "undefined" && MediaSource.isTypeSupported('video/mp4; codecs="avc1.640029, mp4a.40.2"'));
  test.skip(!canPlay, "这个 Chromium 没有 H.264/AAC：播放层走「播不了就放行」，由上一条用例覆盖");
  // CDN 挂起不应答：播放层停在加载中，等人点「跳过」
  await page.route(PROMO_CDN, () => {});
  await page.goto("/sites/portal/join-us");
  const promo = page.getByRole("dialog", { name: "极客班宣传片" });
  await expect(promo).toBeVisible();
  await expect(page.getByRole("button", { name: /跳过/ })).toBeFocused();
  // 画面上只有「跳过」一个按钮：没有播放 / 暂停、进度、音量、「打开声音」（#142）
  await expect(promo.getByRole("button")).toHaveCount(1);
  await page.getByRole("button", { name: /跳过/ }).click();
  await expect(promo).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "致 长江大学极客班：" })).toBeVisible({ timeout: 15_000 * SLOW });
  expect((await context.cookies()).find((cookie) => cookie.name === "yugc_promo_seen")?.value).toBe("1");
  await page.reload();
  await expect(page.getByRole("heading", { name: "致 长江大学极客班：" })).toBeVisible({ timeout: 15_000 * SLOW });
  await expect(promo).toHaveCount(0);
});

test("clicking the video keeps keyboard control: Esc still skips the promo", async ({ page }) => {
  await page.goto("/sites/portal/docs");
  const canPlay = await page.evaluate(() => typeof MediaSource !== "undefined" && MediaSource.isTypeSupported('video/mp4; codecs="avc1.640029, mp4a.40.2"'));
  test.skip(!canPlay, "这个 Chromium 没有 H.264/AAC：播放层走「播不了就放行」");
  await page.route(PROMO_CDN, () => {});
  await page.goto("/sites/portal/join-us");
  const promo = page.getByRole("dialog", { name: "极客班宣传片" });
  await expect(promo).toBeVisible();
  await page.locator(".pt-promo-video").click();
  await expect(promo).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(promo).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "致 长江大学极客班：" })).toBeVisible({ timeout: 15_000 * SLOW });
});

test.describe("promo on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("held upright, the promo turns sideways to fill the screen and 跳过 still works", async ({ page }) => {
    await page.goto("/sites/portal/docs");
    const canPlay = await page.evaluate(() => typeof MediaSource !== "undefined" && MediaSource.isTypeSupported('video/mp4; codecs="avc1.640029, mp4a.40.2"'));
    test.skip(!canPlay, "这个 Chromium 没有 H.264/AAC：播放层走「播不了就放行」");
    await page.route(PROMO_CDN, () => {});
    await page.goto("/sites/portal/join-us");
    const promo = page.getByRole("dialog", { name: "极客班宣传片" });
    await expect(promo).toBeVisible();
    const frame = await page.locator(".pt-promo-frame").evaluate((element) => ({ transform: getComputedStyle(element).transform, box: element.getBoundingClientRect().toJSON() }));
    // rotate(90deg) 的矩阵是 matrix(0, 1, -1, 0, …)；转过来以后画面框占满竖着的屏幕
    expect(frame.transform).toMatch(/^matrix\(0, 1, -1, 0,/);
    expect(Math.round(frame.box.width)).toBe(390);
    expect(Math.round(frame.box.height)).toBe(844);
    expect(await page.locator(".pt-promo").getAttribute("data-codec")).toBe("h264");
    await page.getByRole("button", { name: /跳过/ }).tap();
    await expect(promo).toHaveCount(0);
  });
});

test("console navigation follows the persona's permissions, with no GitHub organisation pages (#274)", async ({ page }) => {
  const nav = page.getByRole("navigation", { name: "控制台导航" });
  await openConsole(page, "/console", "owner");
  await expect(page.getByRole("heading", { name: "概览", level: 1 })).toBeVisible();
  for (const name of ["投递管理", "用户", "权限", "邀请码", "账号同步", "群组与项目", "操作记录", "意见箱"]) await expect(nav.getByRole("button", { name, exact: true })).toBeVisible();
  await expect(nav.getByText(/GitHub/)).toHaveCount(0);

  await openConsole(page, "/console", "ai_head");
  for (const name of ["投递管理", "用户", "操作记录"]) await expect(nav.getByRole("button", { name, exact: true })).toBeVisible();
  for (const name of ["权限", "邀请码", "账号同步", "意见箱"]) await expect(nav.getByRole("button", { name, exact: true })).toHaveCount(0);

  for (const persona of ["member", "registered"]) {
    await openConsole(page, "/console", persona);
    await expect(page.getByRole("heading", { name: "你还不能使用控制台" })).toBeVisible();
    await expect(nav).toHaveCount(0);
  }
});

test("console pages explain a missing node instead of rendering data", async ({ page }) => {
  await openConsole(page, "/console/permissions", "ai_head");
  await expect(page.getByText("你没有「查看权限」权限")).toBeVisible();
});

test("signed-out visitors land on the unified sign-in page with a return path and server-listed providers (#262)", async ({ page }) => {
  await openConsole(page, "/console/users", "signed_out");
  await expect(page).toHaveURL(/\/signin\?return_to=/);
  await expect(page.getByRole("heading", { name: "极客班统一登录" })).toBeVisible();
  await expect(page.getByRole("button", { name: "通过 GitHub 继续" })).toBeVisible();
  await expect(page.getByText("/console/users")).toBeVisible();
});

test("before the console script arrives the entry page already says 正在加载控制台, and hides it once the console renders (#263)", async ({ page }) => {
  let release = () => {};
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/src/main.ts", async route => { await held; await route.continue(); });
  const url = new URL("/console", CONSOLE_ORIGIN);
  url.searchParams.set("__data", "mock");
  url.searchParams.set("__persona", "owner");
  // 模块脚本还没到，load 与 DOMContentLoaded 都不会发生，只等入口页开始到达。
  await page.goto(url.toString(), { waitUntil: "commit" });
  const boot = page.getByRole("status").filter({ hasText: "正在加载控制台" });
  await expect(boot).toBeVisible();
  await expect(page.getByText("网络较慢，长时间没有反应可以刷新页面")).toBeHidden();
  await expect(page.locator("#app")).toBeEmpty();
  release();
  await expect(page.getByRole("heading", { name: "概览", level: 1 })).toBeVisible({ timeout: 15_000 * SLOW });
  await expect(boot).toBeHidden();
});

test("the user list filters by level and opens a drawer with profile, activity and effective permissions (#274)", async ({ page }) => {
  await openConsole(page, "/console/users", "owner");
  await expect(page.getByRole("heading", { name: "用户", level: 1 })).toBeVisible();
  await page.getByRole("toolbar", { name: "按身份筛选" }).getByRole("button", { name: /^往届成员/ }).click();
  await expect(page).toHaveURL(/level=alumni/);
  await expect(page.getByRole("link", { name: "打开 高远 的详情" })).toBeVisible();
  await expect(page.getByRole("link", { name: "打开 李晓曼 的详情" })).toHaveCount(0);

  await openConsole(page, "/console/users", "owner");
  await page.getByRole("link", { name: "打开 李晓曼 的详情" }).click();
  for (const name of ["资料", "操作记录", "有效权限"]) await expect(page.getByRole("tab", { name, exact: true })).toBeVisible();
  // 部门是 6 个单选，称号只列 AI部门 的
  await expect(page.getByRole("radiogroup", { name: "部门" }).getByRole("radio")).toHaveCount(6);
  await expect(page.getByRole("radiogroup", { name: "称号" }).getByRole("radio", { name: "部长" })).toBeChecked();
});

test("a department head only sees their own department in the user list", async ({ page }) => {
  await openConsole(page, "/console/users", "ai_head");
  await expect(page.getByRole("link", { name: /^打开 .+ 的详情$/ })).toHaveCount(4);
  await expect(page.getByRole("link", { name: "打开 陈航 的详情" })).toHaveCount(0);
});

test("permission groups are listed by kind; system groups cannot be deleted, deleting a custom one starts on Cancel", async ({ page }) => {
  await openConsole(page, "/console/permissions", "owner");
  for (const name of ["组", "节点", "解释"]) await expect(page.getByRole("tab", { name, exact: true })).toBeVisible();
  const list = page.getByRole("navigation", { name: "全部组" });
  for (const heading of ["身份", "部门", "称号", "自定义"]) await expect(list.getByText(heading, { exact: true })).toBeVisible();
  await list.getByRole("button", { name: /AI部门 · 部长/ }).click();
  await expect(page).toHaveURL(/group=title\.ai\.head/);
  await expect(page.getByRole("button", { name: "删除", exact: true })).toHaveCount(0);

  await openConsole(page, "/console/permissions?group=custom.muted", "owner");
  await page.getByRole("button", { name: "删除", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "取消" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("开发预览是只读的")).toHaveCount(0);
});

test("a write after the step-up window offers 重新登录 instead of 重试", async ({ page }) => {
  await openConsole(page, "/console/gitlab/settings", "owner_stale");
  await page.getByRole("radiogroup", { name: "同步模式" }).getByText("预演").click();
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("需要重新登录")).toBeVisible();
  await expect(page.getByRole("link", { name: "重新登录" }).or(page.getByRole("button", { name: "重新登录" }))).toBeVisible();
});

test("the activity log filters by outcome and shows today's blocked count", async ({ page }) => {
  await openConsole(page, "/console/activity?outcome=limited", "owner");
  await expect(page.getByRole("heading", { name: "操作记录", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^今天被拦下 \d+ 次$/ })).toBeVisible();
  const outcomes = await page.locator("tbody tr .tx-status-badge").allTextContents();
  expect(outcomes.length).toBeGreaterThan(0);
  for (const text of outcomes) expect(text.trim()).toBe("限流");
});

test("no native select or checkbox is visible on the rebuilt console pages", async ({ page }) => {
  const countNative = () => page.evaluate(() => [...document.querySelectorAll("select, input[type=checkbox]")].filter(el => {
    const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return r.width > 1 && r.height > 1 && s.visibility !== "hidden" && s.display !== "none" && s.opacity !== "0";
  }).length);
  for (const path of ["/console/users", "/console/permissions", "/console/permissions?tab=explain", "/console/activity", "/console/gitlab/settings", "/console/gitlab/projects"]) {
    await openConsole(page, path, "owner");
    await expect(page.locator("main h1")).toBeVisible();
    expect(await countNative(), path).toBe(0);
  }
});

test("mobile console keeps navigation in a drawer and has no page-level horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/console/users", "/console/permissions", "/console/activity", "/console/gitlab/projects"]) {
    await openConsole(page, path, "owner");
    await expect(page.locator("main h1")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth), path).toBeLessThanOrEqual(390);
  }
  await page.getByRole("button", { name: "打开导航" }).click();
  const nav = page.getByRole("navigation", { name: "控制台导航" }).last();
  await nav.getByRole("button", { name: "投递管理" }).click();
  await expect(page).toHaveURL(/\/console\/applications/);
  await expect(page.getByRole("heading", { name: "投递管理", level: 1 })).toBeVisible();
});

test("forum 3D page resets its scene when restored from the back/forward cache (#109)", async ({ page }) => {
  // 论坛（开发态 3456）回 204：导航被取消，页面停在转场最后一帧——和从论坛后退、浏览器从往返缓存恢复时看到的一样
  await page.route("http://127.0.0.1:3456/**", route => route.fulfill({ status: 204 }));
  await page.goto("/sites/portal/forum-3d");
  const board = page.locator(".pt-boards a").first();
  // 场景建好后悬停才会高亮（is-hot 由场景回调设置），以此确认点击会走转场而不是直接跳转
  await expect(async () => {
    await page.mouse.move(0, 0);
    await board.hover();
    await expect(board).toHaveClass(/is-hot/, { timeout: 500 * SLOW });
  }).toPass({ timeout: 30_000 * SLOW });
  const pose = () =>
    page.evaluate(() => {
      const stage = (window as unknown as { __yugcStage?: { basePos: { x: number; y: number; z: number }; baseOffset: { x: number; y: number } } }).__yugcStage!;
      return { x: stage.basePos.x, y: stage.basePos.y, z: stage.basePos.z, ox: stage.baseOffset.x, oy: stage.baseOffset.y };
    });
  const wipeOpacity = () => page.locator(".pt-wipe").evaluate(el => Number(getComputedStyle(el).opacity));
  const start = await pose();
  await board.click();
  await expect.poll(wipeOpacity, { timeout: 15_000 * SLOW }).toBeGreaterThan(0.95);
  const pushed = await pose();
  expect(Math.hypot(pushed.x - start.x, pushed.y - start.y, pushed.z - start.z)).toBeGreaterThan(1);

  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  await expect(page.locator(".pt-wipe")).toHaveCSS("opacity", "0");
  const back = await pose();
  for (const key of ["x", "y", "z", "ox", "oy"] as const) expect(back[key]).toBeCloseTo(start[key], 5);
  // 复位后场景又能响应：再点一个版块会重新推近
  await page.locator(".pt-boards a").nth(1).click();
  await expect.poll(wipeOpacity, { timeout: 15_000 * SLOW }).toBeGreaterThan(0.95);
});
