// 「新来的看这里」便签看过没有（SPEC §4.4）：这个浏览器记在 localStorage["yugc:start-note-seen"]（看过时的毫秒时间戳），
// 登录了再看账号的 prefs.start_note_seen_at，两处有一处记过就不再自动出现。关掉便签或点了其中任一步，两处一起记。
import { api } from "@shared/lib/api";

export const NOTE_SEEN_KEY = "yugc:start-note-seen";

export function noteSeenHere(): boolean {
  try {
    return Boolean(localStorage.getItem(NOTE_SEEN_KEY));
  } catch {
    return false;
  }
}

export function rememberNoteHere(at: number): void {
  try {
    localStorage.setItem(NOTE_SEEN_KEY, String(at));
  } catch {
    /* 隐私模式下写不了：只影响这个浏览器下次还会不会自动出现 */
  }
}

/** 记到账号上（PATCH /api/identity/profile 的 prefs 是合并写，CONTRACT-274 §2）；失败不提示，这个浏览器已经记过了 */
export function rememberNoteOnAccount(at: number): Promise<boolean> {
  return api("/api/identity/profile", { method: "PATCH", body: JSON.stringify({ prefs: { start_note_seen_at: at } }) }).then(
    () => true,
    () => false,
  );
}
