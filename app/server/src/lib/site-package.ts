// 比赛官网站点包（#278，CONTRACT-278 §1）：zip 的读、写与校验。
//
// 服务端上传接口和 scripts/contest-site.mjs（本地 pack / check）共用这一份，所以这里只依赖 node: 内置模块、
// 只用能被 Node 直接去掉类型的写法（没有 enum、namespace、参数属性），不导入仓库里的别的文件。
// 只认最常见的 zip：不加密、不分卷、不是 zip64，压缩方式只有存储（0）和 deflate（8）。别的一律拒绝，不尝试兼容。
import { createHash } from "node:crypto";
import { crc32, deflateRawSync, inflateRawSync } from "node:zlib";

export const SITE_LIMITS = {
  zipBytes: 20 * 1024 * 1024,
  files: 500,
  totalBytes: 50 * 1024 * 1024,
  pathLength: 200,
} as const;
export const SITE_EXTENSIONS = ["html", "css", "js", "mjs", "json", "svg", "png", "jpg", "jpeg", "webp", "avif", "woff2", "txt", "ico", "mp3", "ogg"] as const;
export const SITE_MANIFEST = "yzgc-site.json";
export const SITE_CONTENT_TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  avif: "image/avif",
  woff2: "font/woff2",
  txt: "text/plain; charset=utf-8",
  ico: "image/x-icon",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
};

export type SiteManifest = { name: string; version: string; sdk: string; competition_id?: string };
export type SiteFile = { path: string; data: Buffer };
/** 校验结果：`ok` 为 false 时 `report` 逐条写原因，`files` 为空，调用方不落任何文件。 */
export type SiteCheck = {
  ok: boolean;
  report: string[];
  sha256: string;
  size: number;
  files: SiteFile[];
  manifest: SiteManifest | null;
  totalBytes: number;
};

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;
const ZIP64_LOCATOR = 0x07064b50;
const UNIX_HOST = 3;
const S_IFMT = 0o170000;
const S_IFLNK = 0o120000;
const S_IFDIR = 0o040000;
const VERSION_PATTERN = /^[0-9A-Za-z][0-9A-Za-z._+-]{0,31}$/;

const extensionOf = (path: string) => {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
};

/** 站点里的一个路径能不能用：相对、正斜杠、没有 `.`/`..`/空段/隐藏段/控制字符，扩展名在白名单里。返回不能用的原因。 */
export function sitePathProblem(path: string): string | null {
  if (!path) return "路径为空";
  if (path.length > SITE_LIMITS.pathLength) return `路径超过 ${SITE_LIMITS.pathLength} 个字符`;
  if (/[\u0000-\u001f\u007f\\]/.test(path)) return "路径里有控制字符或反斜杠";
  if (path.startsWith("/") || /^[A-Za-z]:/.test(path)) return "不能用绝对路径";
  const segments = path.split("/");
  for (const segment of segments) {
    if (segment === "..") return "不能包含 ..";
    if (segment === "" || segment === ".") return "路径里有空段或 .";
    if (segment.startsWith(".")) return "不能包含以 . 开头的文件或目录";
  }
  if (!(SITE_EXTENSIONS as readonly string[]).includes(extensionOf(path))) return "扩展名不在允许的列表里";
  return null;
}

export function siteContentType(path: string): string {
  return SITE_CONTENT_TYPES[extensionOf(path)] ?? "application/octet-stream";
}

function readManifest(data: Buffer, competitionId: string | null, report: string[]): SiteManifest | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(data));
  } catch {
    report.push(`${SITE_MANIFEST} 不是合法的 JSON`);
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    report.push(`${SITE_MANIFEST} 必须是一个 JSON 对象`);
    return null;
  }
  const value = parsed as Record<string, unknown>;
  const before = report.length;
  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (!name || name.length > 80) report.push(`${SITE_MANIFEST} 的 name 必须是 1–80 个字符的字符串`);
  const version = typeof value.version === "string" ? value.version.trim() : "";
  if (!VERSION_PATTERN.test(version)) report.push(`${SITE_MANIFEST} 的 version 必须是 1–32 位的字母、数字、点、加号、下划线或连字符`);
  const sdk = typeof value.sdk === "string" ? value.sdk.trim() : "";
  if (!sdk || sdk.length > 32) report.push(`${SITE_MANIFEST} 的 sdk 必须是 1–32 个字符的字符串`);
  let competition: string | undefined;
  if (value.competition_id !== undefined) {
    if (typeof value.competition_id !== "string" || !value.competition_id) report.push(`${SITE_MANIFEST} 的 competition_id 必须是字符串`);
    else {
      competition = value.competition_id;
      if (competitionId !== null && competition !== competitionId) report.push(`${SITE_MANIFEST} 的 competition_id 是 ${competition}，和要上传到的比赛 ${competitionId} 不一致`);
    }
  }
  if (report.length > before) return null;
  return { name, version, sdk, ...(competition !== undefined ? { competition_id: competition } : {}) };
}

/**
 * 读并校验一个站点包。`competitionId` 为 null 时不比对清单里的 competition_id（本地 check 没有目标比赛）。
 * 先只读中央目录核对数量、大小、路径与类型，全部过关才解压，解压时按声明的大小封顶并核对 CRC，防止压缩炸弹。
 */
export function checkSitePackage(zip: Buffer, competitionId: string | null): SiteCheck {
  const sha256 = createHash("sha256").update(zip).digest("hex");
  const report: string[] = [];
  const result = (files: SiteFile[] = [], manifest: SiteManifest | null = null, totalBytes = 0): SiteCheck => ({
    ok: report.length === 0, report, sha256, size: zip.length, files: report.length ? [] : files, manifest: report.length ? null : manifest, totalBytes,
  });
  if (zip.length > SITE_LIMITS.zipBytes) {
    report.push(`站点包 ${zip.length} 字节，超过 20MB`);
    return result();
  }
  // 中央目录结尾记录：在最后 22 + 65535 字节里从后往前找签名
  let eocd = -1;
  for (let at = zip.length - 22; at >= Math.max(0, zip.length - 22 - 0xffff); at--) {
    if (zip.readUInt32LE(at) === EOCD) { eocd = at; break; }
  }
  if (eocd < 0) {
    report.push("不是 zip 文件（找不到中央目录）");
    return result();
  }
  if (eocd >= 20 && zip.readUInt32LE(eocd - 20) === ZIP64_LOCATOR) {
    report.push("不支持 zip64 格式");
    return result();
  }
  const disk = zip.readUInt16LE(eocd + 4);
  const centralDisk = zip.readUInt16LE(eocd + 6);
  const entriesHere = zip.readUInt16LE(eocd + 8);
  const entries = zip.readUInt16LE(eocd + 10);
  const centralSize = zip.readUInt32LE(eocd + 12);
  const centralOffset = zip.readUInt32LE(eocd + 16);
  if (disk !== 0 || centralDisk !== 0 || entriesHere !== entries) {
    report.push("不支持分卷 zip");
    return result();
  }
  if (entries === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    report.push("不支持 zip64 格式");
    return result();
  }
  if (centralOffset + centralSize > eocd) {
    report.push("zip 的中央目录位置不对");
    return result();
  }

  type Entry = { path: string; method: number; crc: number; compressed: number; size: number; localOffset: number };
  const files: Entry[] = [];
  const seen = new Set<string>();
  let declaredTotal = 0;
  let cursor = centralOffset;
  const decoder = new TextDecoder("utf-8", { fatal: true });
  for (let index = 0; index < entries; index++) {
    if (cursor + 46 > eocd || zip.readUInt32LE(cursor) !== CENTRAL) {
      report.push("zip 的中央目录损坏");
      return result();
    }
    const madeBy = zip.readUInt16LE(cursor + 4);
    const flags = zip.readUInt16LE(cursor + 8);
    const method = zip.readUInt16LE(cursor + 10);
    const crc = zip.readUInt32LE(cursor + 16);
    const compressed = zip.readUInt32LE(cursor + 20);
    const size = zip.readUInt32LE(cursor + 24);
    const nameLength = zip.readUInt16LE(cursor + 28);
    const extraLength = zip.readUInt16LE(cursor + 30);
    const commentLength = zip.readUInt16LE(cursor + 32);
    const startDisk = zip.readUInt16LE(cursor + 34);
    const external = zip.readUInt32LE(cursor + 38);
    const localOffset = zip.readUInt32LE(cursor + 42);
    const nameBytes = zip.subarray(cursor + 46, cursor + 46 + nameLength);
    cursor += 46 + nameLength + extraLength + commentLength;
    let path: string;
    try {
      path = decoder.decode(nameBytes);
    } catch {
      report.push(`第 ${index + 1} 个文件名不是 UTF-8`);
      continue;
    }
    if (flags & 0x1) { report.push(`${path}：加密的文件不收`); continue; }
    if (startDisk !== 0 || compressed === 0xffffffff || size === 0xffffffff || localOffset === 0xffffffff) { report.push(`${path}：不支持 zip64 或分卷`); continue; }
    const mode = (madeBy >> 8) === UNIX_HOST ? (external >>> 16) & 0xffff : 0;
    if ((mode & S_IFMT) === S_IFLNK) { report.push(`${path}：不能是符号链接`); continue; }
    const directory = path.endsWith("/") || (mode & S_IFMT) === S_IFDIR || (external & 0x10) !== 0;
    if (directory) {
      const trimmed = path.replace(/\/+$/, "");
      if (trimmed.startsWith("/") || trimmed.split("/").some(segment => segment === ".." || segment === "." || segment === "" || segment.startsWith("."))) {
        report.push(`${path}：目录路径不合规`);
      }
      continue;
    }
    const problem = sitePathProblem(path);
    if (problem) { report.push(`${path}：${problem}`); continue; }
    const key = path.toLowerCase();
    if (seen.has(key)) { report.push(`${path}：重复的文件（不分大小写）`); continue; }
    seen.add(key);
    if (method !== 0 && method !== 8) { report.push(`${path}：只收存储或 deflate 压缩的文件`); continue; }
    declaredTotal += size;
    files.push({ path, method, crc, compressed, size, localOffset });
  }
  if (cursor !== centralOffset + centralSize && report.length === 0) report.push("zip 的中央目录大小不对");
  if (files.length > SITE_LIMITS.files) report.push(`有 ${files.length} 个文件，超过 ${SITE_LIMITS.files} 个`);
  if (declaredTotal > SITE_LIMITS.totalBytes) report.push(`解压后合计 ${declaredTotal} 字节，超过 50MB`);
  if (!files.some(file => file.path === "index.html")) report.push("根目录必须有 index.html");
  if (!files.some(file => file.path === SITE_MANIFEST)) report.push(`根目录必须有 ${SITE_MANIFEST}`);
  if (report.length) return result();

  const extracted: SiteFile[] = [];
  for (const file of files) {
    const at = file.localOffset;
    if (at + 30 > centralOffset || zip.readUInt32LE(at) !== LOCAL) { report.push(`${file.path}：本地文件头损坏`); continue; }
    const start = at + 30 + zip.readUInt16LE(at + 26) + zip.readUInt16LE(at + 28);
    const end = start + file.compressed;
    if (end > centralOffset) { report.push(`${file.path}：数据越过了中央目录`); continue; }
    const raw = zip.subarray(start, end);
    let data: Buffer;
    try {
      // maxOutputLength 按声明的大小封顶：实际比声明大时直接抛错，不会被撑爆内存
      data = file.method === 0 ? Buffer.from(raw) : inflateRawSync(raw, { maxOutputLength: Math.max(1, file.size) });
    } catch {
      report.push(`${file.path}：解压失败或比声明的大小大`);
      continue;
    }
    if (file.method === 8 && file.size === 0 && data.length > 0) { report.push(`${file.path}：比声明的大小大`); continue; }
    if (data.length !== file.size) { report.push(`${file.path}：解压后的大小和声明的不一致`); continue; }
    if ((crc32(data) >>> 0) !== file.crc) { report.push(`${file.path}：校验和不对`); continue; }
    extracted.push({ path: file.path, data });
  }
  if (report.length) return result();
  const manifestFile = extracted.find(file => file.path === SITE_MANIFEST)!;
  const manifest = readManifest(manifestFile.data, competitionId, report);
  return result(extracted, manifest, declaredTotal);
}

/** 打一个 zip（scripts/contest-site.mjs pack 与测试用）：UTF-8 文件名、固定时间戳（同样的输入打出同样的包）、文本类文件 deflate。 */
export function writeZip(files: SiteFile[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  const DOS_TIME = 0;
  const DOS_DATE = (0 << 9) | (1 << 5) | 1; // 1980-01-01
  for (const file of files) {
    const name = Buffer.from(file.path, "utf8");
    const deflated = deflateRawSync(file.data, { level: 9 });
    const useDeflate = deflated.length < file.data.length;
    const body = useDeflate ? deflated : file.data;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(file.data) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(LOCAL, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, body);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(CENTRAL, 0);
    central.writeUInt16LE((UNIX_HOST << 8) | 20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(file.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(((0o100644 << 16) >>> 0), 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += 30 + name.length + body.length;
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(EOCD, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}
