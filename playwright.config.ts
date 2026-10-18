import { defineConfig, devices } from "@playwright/test";

/** 官网（app/web，React）与控制台（app/console，Vue + Tuffex）各起一个 dev server，端口与日常开发错开。 */
export const PORTAL_ORIGIN = "http://127.0.0.1:5179";
export const CONSOLE_ORIGIN = "http://127.0.0.1:5189";

/** 超时倍数：托管 runner 只有 2 核、无 GPU，3D 入场与首屏编译比本机慢几倍；本机默认 1，CI 设 E2E_TIMEOUT_SCALE。 */
export const SLOW = Number(process.env.E2E_TIMEOUT_SCALE ?? 1);

export default defineConfig({
  timeout: 30_000 * SLOW,
  expect: { timeout: 5_000 * SLOW },
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // CI 上多出一份可下载的 HTML 报告（含 trace），本机仍只在终端看列表。
  reporter: process.env.CI ? [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]] : "list",
  use: {
    baseURL: PORTAL_ORIGIN,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "pnpm --filter @yzgc/web exec vite --host 127.0.0.1 --port 5179 --strictPort",
      url: `${PORTAL_ORIGIN}/sites/portal/`,
      reuseExistingServer: false,
      timeout: 30000,
    },
    {
      command: "pnpm --filter @yzgc/console exec vite --host 127.0.0.1 --port 5189 --strictPort",
      url: `${CONSOLE_ORIGIN}/console`,
      reuseExistingServer: false,
      timeout: 30000,
    },
  ],
});
