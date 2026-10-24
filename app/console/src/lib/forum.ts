// 控制台「论坛管理」（#276，CONTRACT-276 §8）的纯逻辑：可见范围的说法、表情与表情包的表单检查和提交内容。
// 不导入 Vue，tests/console 直接测。规则与服务端一致（app/server/src/lib/forum-rules.ts 的 FORUM_LIMITS、
// app/server/src/routes/console/forum.ts）：短码 2–40 位小写字母、数字和 -，名字最多 20 字，图片 PNG/JPEG/WebP 不超过 2MB。
import type { ConsoleSticker, ConsoleStickerPack, ForumVisibility } from "./types";

export const VISIBILITY_OPTIONS: { value: ForumVisibility; label: string }[] = [
  { value: "public", label: "所有人" },
  { value: "registered", label: "注册用户" },
  { value: "member", label: "极客班成员" },
];
export const visibilityLabel = (value: ForumVisibility) => VISIBILITY_OPTIONS.find(option => option.value === value)?.label ?? value;

export const STICKER_SHORTCODE = /^[a-z0-9][a-z0-9-]{1,39}$/;
export const STICKER_LABEL_MAX = 20;
export const PACK_NAME_MAX = 64;
export const SORT_MAX = 100_000;
export const STICKER_FILE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const STICKER_FILE_MAX = 2 * 1024 * 1024;

/** 按排序值、再按短码排；服务端回的顺序不保证。 */
export const sortedStickers = (pack: ConsoleStickerPack): ConsoleSticker[] =>
  [...pack.stickers].sort((a, b) => a.sort - b.sort || a.shortcode.localeCompare(b.shortcode));

export const packUses = (pack: ConsoleStickerPack) => pack.stickers.reduce((sum, sticker) => sum + sticker.use_count, 0);

/** 这个包里下一个表情的排序值：排在最后，留 10 的间隔方便以后插进去。 */
export const nextSort = (pack: ConsoleStickerPack) => (pack.stickers.length ? Math.max(...pack.stickers.map(sticker => sticker.sort)) + 10 : 0);

const sortProblem = (sort: number) => (!Number.isInteger(sort) || sort < 0 || sort > SORT_MAX ? `排序是 0 到 ${SORT_MAX} 的整数` : undefined);

export type StickerDraft = { label: string; sort: number };
export const stickerDraftFrom = (sticker: ConsoleSticker): StickerDraft => ({ label: sticker.label, sort: sticker.sort });

export function stickerDraftErrors(draft: StickerDraft): Partial<Record<keyof StickerDraft, string>> {
  const errors: Partial<Record<keyof StickerDraft, string>> = {};
  const label = draft.label.trim();
  if (!label) errors.label = "写一个名字，读屏和悬停提示会读它";
  else if ([...label].length > STICKER_LABEL_MAX) errors.label = `名字最多 ${STICKER_LABEL_MAX} 个字`;
  const sort = sortProblem(draft.sort);
  if (sort) errors.sort = sort;
  return errors;
}

/** 只带改了的字段；什么都没改时是空对象，页面就不发请求。 */
export function stickerPatch(draft: StickerDraft, original: ConsoleSticker): Partial<StickerDraft> {
  const patch: Partial<StickerDraft> = {};
  if (draft.label.trim() !== original.label) patch.label = draft.label.trim();
  if (draft.sort !== original.sort) patch.sort = draft.sort;
  return patch;
}

export type PackDraft = { name: string; sort: number };
export const packDraftFrom = (pack: ConsoleStickerPack): PackDraft => ({ name: pack.name, sort: pack.sort });

export function packDraftErrors(draft: PackDraft): Partial<Record<keyof PackDraft, string>> {
  const errors: Partial<Record<keyof PackDraft, string>> = {};
  const name = draft.name.trim();
  if (!name) errors.name = "写一个表情包名字";
  else if ([...name].length > PACK_NAME_MAX) errors.name = `名字最多 ${PACK_NAME_MAX} 个字`;
  const sort = sortProblem(draft.sort);
  if (sort) errors.sort = sort;
  return errors;
}

export function packPatch(draft: PackDraft, original: ConsoleStickerPack): Partial<PackDraft> {
  const patch: Partial<PackDraft> = {};
  if (draft.name.trim() !== original.name) patch.name = draft.name.trim();
  if (draft.sort !== original.sort) patch.sort = draft.sort;
  return patch;
}

export function stickerFileProblem(file: { type: string; size: number } | null): string | undefined {
  if (!file) return "选一张图片";
  if (!(STICKER_FILE_TYPES as readonly string[]).includes(file.type)) return "只支持 PNG、JPEG、WebP";
  if (file.size > STICKER_FILE_MAX) return "图片不能超过 2MB";
  return undefined;
}

export type NewStickerDraft = { shortcode: string; label: string };

/** `taken` 是所有包里已有的短码（停用的也算，服务端同样挡）。 */
export function newStickerErrors(draft: NewStickerDraft, file: { type: string; size: number } | null, taken: ReadonlySet<string>): Partial<Record<"shortcode" | "label" | "file", string>> {
  const errors: Partial<Record<"shortcode" | "label" | "file", string>> = {};
  const shortcode = draft.shortcode.trim();
  if (!STICKER_SHORTCODE.test(shortcode)) errors.shortcode = "短码 2 到 40 位，只用小写字母、数字和 -，开头不能是 -";
  else if (taken.has(shortcode)) errors.shortcode = "这个短码已经被用过了，停用的表情也占着它";
  const label = stickerDraftErrors({ label: draft.label, sort: 0 }).label;
  if (label) errors.label = label;
  const fileProblem = stickerFileProblem(file);
  if (fileProblem) errors.file = fileProblem;
  return errors;
}

export const takenShortcodes = (packs: ConsoleStickerPack[]) => new Set(packs.flatMap(pack => pack.stickers.map(sticker => sticker.shortcode)));

/** 新增表情：请求体是图片本身，短码和名字在查询串里。 */
export const stickerUploadPath = (packId: string, draft: NewStickerDraft) =>
  `/api/console/forum/sticker-packs/${encodeURIComponent(packId)}/stickers?${new URLSearchParams({ shortcode: draft.shortcode.trim(), label: draft.label.trim() })}`;

/** 表情包 id（#276）：小写字母、数字和 -，1 到 40 位，之后当这个包里表情短码的前缀，建好后不能改。 */
export const PACK_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
export type NewPackDraft = { id: string; name: string };

export function newPackErrors(draft: NewPackDraft, existing: ReadonlySet<string>): Partial<Record<keyof NewPackDraft, string>> {
  const errors: Partial<Record<keyof NewPackDraft, string>> = {};
  const id = draft.id.trim();
  if (!PACK_ID.test(id)) errors.id = "id 1 到 40 位，只用小写字母、数字和 -，开头不能是 -";
  else if (existing.has(id)) errors.id = "这个 id 已经有表情包在用了";
  const name = draft.name.trim();
  if (!name) errors.name = "写上表情包的名字";
  else if (name.length > PACK_NAME_MAX) errors.name = `名字最多 ${PACK_NAME_MAX} 个字`;
  return errors;
}

/**
 * 批量上传时按文件名起草短码和名字：短码是「包 id-文件名里的小写字母数字」，
 * 和已有的、同一批里前面的撞了就在后面加 -2、-3；名字是去掉扩展名的文件名，最多 20 个字。
 * 起草的只是默认值，上传前每一行都还能改。
 */
export function draftsFromFiles(packId: string, names: readonly string[], taken: ReadonlySet<string>): NewStickerDraft[] {
  const used = new Set(taken);
  return names.map((name, index) => {
    const base = name.replace(/\.[^.]+$/, "").trim();
    const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || String(index + 1);
    const stem = `${packId}-${slug}`.slice(0, 36).replace(/-+$/, "");
    let shortcode = stem;
    for (let n = 2; used.has(shortcode); n++) shortcode = `${stem}-${n}`;
    used.add(shortcode);
    return { shortcode, label: [...(base || slug)].slice(0, STICKER_LABEL_MAX).join("") };
  });
}

/** B 站那样的写法 `[包名_名字]`（#276）：论坛聊天框里打出来就变成这个表情，与论坛 shared/post-markdown.ts 的 stickerToken 同一写法。 */
export const stickerToken = (packName: string, label: string) => `[${packName}_${label}]`;

/** 同一个包里名字不能重复，同名的表情包也不行，不然 `[包名_名字]` 认不出是哪一张。`except` 是正在改的那一个的 id。 */
export const labelTaken = (pack: ConsoleStickerPack | null | undefined, label: string, except?: string) =>
  Boolean(pack?.stickers.some(sticker => sticker.id !== except && sticker.label === label.trim()));
export const packNameTaken = (packs: readonly ConsoleStickerPack[], name: string, except?: string) =>
  packs.some(pack => pack.id !== except && pack.name === name.trim());

/** 表情包卡片的封面：排在前面的、启用中的几张。 */
export const packCover = (pack: ConsoleStickerPack, count = 4) => sortedStickers(pack).filter(sticker => sticker.enabled).slice(0, count);
