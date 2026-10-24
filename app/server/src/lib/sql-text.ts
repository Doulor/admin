/**
 * 几个控制台路由各自写过一份的小工具，抽成共享实现（#274 残留修复 L/O）：
 * - `escapeLike`：`LIKE ?` 的用户输入转义 `%`、`_`、`\`，配合 `ESCAPE '\\'` 使用，防止用户输入的通配符
 *   被当成真通配符（之前只有 applications.ts、activity.ts 的 action 过滤各自转义过一次，users.ts 的搜索
 *   框完全没转义）。
 * - `csvCell`：CSV 单元格转义，防表格公式注入（以 `= + - @` 开头的单元格前加 `'`）与逗号/引号/换行按
 *   RFC 4180 加引号；以前 applications.ts、competition-roster.ts、activity.ts 各写了一份互不一致的版本
 *   （activity.ts 那份甚至没有公式注入防护）。
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, match => `\\${match}`);
}

export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
