import type Database from "better-sqlite3";

/**
 * 招新总开关（#284）：存在 `app_state`（键 `apply_open`，值 "1" 开放、"0" 关闭），没有这一行就是开放，所以升级前后行为不变。
 * 关闭只拦新的投递（routes/portal/apply.ts 回 403 apply_closed）；已经收到的投递、审核和通知信不受影响。
 * 每个账号每天能投几份是另一回事，见 lib/apply-quota.ts，这里不碰它。
 */
const KEY = "apply_open";

export type ApplySettings = { open: boolean; updated_at: number | null };

export function createApplySettings(db: Database.Database, clock: () => number = Date.now) {
  const read = db.prepare("SELECT value, updated_at FROM app_state WHERE key = ?");
  const write = db.prepare(
    "INSERT INTO app_state(key, value, updated_at) VALUES(?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
  );

  /** 读不懂的值按开放算：只有明确写下的 "0" 才关，一行坏数据不会悄悄把招新关掉。 */
  function get(): ApplySettings {
    const row = read.get(KEY) as { value: string; updated_at: number } | undefined;
    return row ? { open: row.value !== "0", updated_at: row.updated_at } : { open: true, updated_at: null };
  }

  /** 状态没变就不写（包括从没写过、要求"开放"这种等于默认值的情况）：updated_at 只在真的开关过的那一刻变，操作记录也不会多出没有改动的一条。 */
  function setOpen(open: boolean): { settings: ApplySettings; changed: boolean } {
    const before = get();
    if (before.open === open) return { settings: before, changed: false };
    write.run(KEY, open ? "1" : "0", clock());
    return { settings: get(), changed: true };
  }

  return { get, isOpen: () => get().open, setOpen };
}
export type ApplySettingsStore = ReturnType<typeof createApplySettings>;
