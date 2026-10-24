import { afterEach, describe, expect, it, vi } from "vitest";
import {
  STICKER_FILE_MAX, draftsFromFiles, newPackErrors, newStickerErrors, nextSort, packDraftErrors, packPatch, packUses, sortedStickers, stickerDraftErrors, stickerFileProblem,
  stickerPatch, stickerUploadPath, takenShortcodes, visibilityLabel,
} from "../../app/console/src/lib/forum";
import { checkConsoleWrite, routeConsole } from "../../app/console/src/mock/console";
import type { ConsoleSticker, ConsoleStickerPack, ConsoleStickersResponse, ForumCategoriesResponse } from "../../app/console/src/lib/types";

// 控制台「论坛管理」（#276）的纯逻辑：规则与服务端 FORUM_LIMITS、console/forum.ts 一致。
const sticker = (shortcode: string, sort: number, extra: Partial<ConsoleSticker> = {}): ConsoleSticker => ({
  id: shortcode, shortcode, label: shortcode, url: `/api/forum/stickers/${"a".repeat(64)}.webp`, sort, enabled: true, use_count: 0, ...extra,
});
const pack = (stickers: ConsoleSticker[], extra: Partial<ConsoleStickerPack> = {}): ConsoleStickerPack => ({ id: "yugc", name: "极客娘", sort: 0, enabled: true, stickers, ...extra });
const png = (size = 1024) => ({ type: "image/png", size });

describe("可见范围", () => {
  it("用读者能懂的说法", () => {
    expect(["public", "registered", "member"].map(value => visibilityLabel(value as never))).toEqual(["所有人", "注册用户", "极客班成员"]);
  });
});

describe("表情列表", () => {
  it("按排序值排，同值按短码", () => {
    const list = sortedStickers(pack([sticker("yugc-b", 10), sticker("yugc-c", 0), sticker("yugc-a", 10)]));
    expect(list.map(item => item.shortcode)).toEqual(["yugc-c", "yugc-a", "yugc-b"]);
  });

  it("合计回应数，下一个排序值排在最后留 10 的间隔", () => {
    const sample = pack([sticker("yugc-a", 0, { use_count: 3 }), sticker("yugc-b", 40, { use_count: 5 })]);
    expect(packUses(sample)).toBe(8);
    expect(nextSort(sample)).toBe(50);
    expect(nextSort(pack([]))).toBe(0);
  });

  it("停用的表情也占着短码", () => {
    const taken = takenShortcodes([pack([sticker("yugc-a", 0, { enabled: false })]), pack([sticker("cat-b", 0)], { id: "cat" })]);
    expect([...taken].sort()).toEqual(["cat-b", "yugc-a"]);
  });
});

describe("编辑表情与表情包", () => {
  it("名字必填、最多 20 字，排序是 0 到 100000 的整数", () => {
    expect(stickerDraftErrors({ label: "打招呼", sort: 10 })).toEqual({});
    expect(stickerDraftErrors({ label: "  ", sort: 10 }).label).toBeTruthy();
    expect(stickerDraftErrors({ label: "字".repeat(21), sort: 10 }).label).toBe("名字最多 20 个字");
    expect(stickerDraftErrors({ label: "a", sort: -1 }).sort).toBeTruthy();
    expect(stickerDraftErrors({ label: "a", sort: 1.5 }).sort).toBeTruthy();
    expect(stickerDraftErrors({ label: "a", sort: 100_001 }).sort).toBeTruthy();
    expect(packDraftErrors({ name: "", sort: 0 }).name).toBeTruthy();
    expect(packDraftErrors({ name: "字".repeat(65), sort: 0 }).name).toBe("名字最多 64 个字");
  });

  it("只提交改了的字段，名字去掉首尾空格", () => {
    const original = sticker("yugc-wave", 10, { label: "打招呼" });
    expect(stickerPatch({ label: " 打招呼 ", sort: 10 }, original)).toEqual({});
    expect(stickerPatch({ label: "挥手", sort: 20 }, original)).toEqual({ label: "挥手", sort: 20 });
    expect(packPatch({ name: "极客娘", sort: 5 }, pack([]))).toEqual({ sort: 5 });
  });
});

describe("上传新表情", () => {
  it("图片只收 PNG、JPEG、WebP，不超过 2MB", () => {
    expect(stickerFileProblem(null)).toBe("选一张图片");
    expect(stickerFileProblem({ type: "image/gif", size: 10 })).toBe("只支持 PNG、JPEG、WebP");
    expect(stickerFileProblem({ type: "image/webp", size: STICKER_FILE_MAX + 1 })).toBe("图片不能超过 2MB");
    expect(stickerFileProblem({ type: "image/jpeg", size: STICKER_FILE_MAX })).toBeUndefined();
  });

  it("短码照服务端规则，已用的短码当场拦下", () => {
    const taken = new Set(["yugc-wave"]);
    expect(newStickerErrors({ shortcode: "yugc-hi", label: "嗨" }, png(), taken)).toEqual({});
    for (const shortcode of ["a", "-yugc", "Yugc-hi", "yugc_hi", "y".repeat(41)])
      expect(newStickerErrors({ shortcode, label: "嗨" }, png(), taken).shortcode).toBeTruthy();
    expect(newStickerErrors({ shortcode: "yugc-wave", label: "嗨" }, png(), taken).shortcode).toContain("已经被用过");
    expect(Object.keys(newStickerErrors({ shortcode: "", label: "", }, null, taken)).sort()).toEqual(["file", "label", "shortcode"]);
  });

  it("短码和名字放在查询串里，路径编码包 id", () => {
    expect(stickerUploadPath("yugc", { shortcode: " yugc-hi ", label: "嗨 你好" })).toBe("/api/console/forum/sticker-packs/yugc/stickers?shortcode=yugc-hi&label=%E5%97%A8+%E4%BD%A0%E5%A5%BD");
  });
});

describe("新建表情包和批量上传（#276）", () => {
  it("表情包 id 照服务端规则，已有的 id 当场拦下，名字要写", () => {
    const existing = new Set(["yugc"]);
    expect(newPackErrors({ id: "cats", name: "猫猫" }, existing)).toEqual({});
    expect(newPackErrors({ id: "c", name: "猫猫" }, existing)).toEqual({});
    for (const id of ["", "-cats", "Cats", "cat_s", "c".repeat(41)]) expect(newPackErrors({ id, name: "猫猫" }, existing).id, id).toBeTruthy();
    expect(newPackErrors({ id: "yugc", name: "猫猫" }, existing).id).toContain("已经有表情包");
    expect(newPackErrors({ id: "cats", name: "  " }, existing).name).toBe("写上表情包的名字");
    expect(newPackErrors({ id: "cats", name: "名".repeat(65) }, existing).name).toContain("最多 64");
  });

  it("按文件名起草短码和名字：小写字母数字加包前缀，撞了加 -2，名字去掉扩展名", () => {
    const drafts = draftsFromFiles("cats", ["Hello World.png", "hello-world.webp", "开心.png", "cats-hi.jpg"], new Set(["cats-cats-hi"]));
    expect(drafts).toEqual([
      { shortcode: "cats-hello-world", label: "Hello World" },
      { shortcode: "cats-hello-world-2", label: "hello-world" },
      { shortcode: "cats-3", label: "开心" },
      { shortcode: "cats-cats-hi-2", label: "cats-hi" },
    ]);
    for (const draft of drafts) expect(newStickerErrors(draft, png(), new Set()), draft.shortcode).toEqual({});
    const long = draftsFromFiles("cats", [`${"a".repeat(60)}.png`, `${"超长的名字".repeat(6)}.png`], new Set());
    expect(long[0]!.shortcode.length).toBeLessThanOrEqual(40);
    expect([...long[1]!.label].length).toBe(20);
  });
});

describe("开发预览的论坛管理接口", () => {
  afterEach(() => vi.unstubAllGlobals());
  const as = (persona: string) => vi.stubGlobal("window", { location: { search: `?__persona=${persona}` } });
  const write = (path: string, method: string, body?: unknown) => () => checkConsoleWrite(new URL(path, "http://mock.local"), method, body);

  it("站长读得到分类和表情，注册用户读不到", () => {
    as("owner");
    const categories = routeConsole(new URL("http://mock.local/api/console/forum/categories")) as ForumCategoriesResponse;
    expect(categories.categories.map(row => row.id)).toContain("c-exam");
    const stickers = routeConsole(new URL("http://mock.local/api/console/forum/stickers")) as ConsoleStickersResponse;
    expect(stickers.packs[0]?.stickers.some(item => !item.enabled)).toBe(true);
    as("registered");
    expect(() => routeConsole(new URL("http://mock.local/api/console/forum/stickers"))).toThrow(expect.objectContaining({ status: 403 }));
  });

  it("写操作照服务端要权限和刚登录过，重复的短码回 409", () => {
    as("owner");
    expect(write("/api/console/forum/categories/c-exam", "PATCH", { visibility: "member" })).not.toThrow();
    expect(write("/api/console/forum/sticker-packs/yugc/stickers?shortcode=yugc-wave&label=x", "PUT")).toThrow(expect.objectContaining({ status: 409, code: "shortcode_taken" }));
    expect(write("/api/console/forum/sticker-packs/yugc/stickers?shortcode=yugc-new&label=x", "PUT")).not.toThrow();
    expect(write("/api/console/forum/sticker-packs", "POST", { id: "yugc", name: "重复" })).toThrow(expect.objectContaining({ status: 409, code: "pack_id_taken" }));
    expect(write("/api/console/forum/sticker-packs", "POST", { id: "cats", name: "猫猫" })).not.toThrow();
    as("owner_stale");
    expect(write("/api/console/forum/stickers/yugc-wave", "PATCH", { enabled: false })).toThrow(expect.objectContaining({ status: 403, code: "step_up_required" }));
    as("member");
    expect(write("/api/console/forum/sticker-packs/yugc", "PATCH", { enabled: false })).toThrow(expect.objectContaining({ status: 403 }));
  });
});
