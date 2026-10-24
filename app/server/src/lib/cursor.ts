/**
 * 分页游标的编解码（#274 残留修复 P：console/users.ts 和 console/activity.ts 各自写过一份一模一样的
 * base64url(JSON) 编解码，只有字段形状不同，抽成一份共享实现）。调用方自带类型守卫，解不出来、
 * 形状不对都按「没有游标」处理，不抛错——分页游标本来就是不可信的客户端回显。
 */
export function encodeCursor(cursor: unknown): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeCursor<T>(raw: string | undefined, isValid: (value: unknown) => value is T): T | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
