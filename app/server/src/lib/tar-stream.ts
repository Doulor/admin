// 极简 ustar + gzip 的打包/解包（#282 一键备份）：只服务 lib/system-backup.ts 与 scripts/backup-restore.mjs，
// 不是通用 tar 实现——不支持长文件名兜底（GNU longname）、不支持目录/符号链接条目、只处理普通文件。
// 选 tar 而不是 zip：tar 的文件头只需要提前知道大小（没有 zip 中央目录那种「写完才能回填」的问题），
// 配合调用方已经算好的 sha256/size（manifest.json 需要），可以边读源文件边写进输出流，不用把整个归档
// 攒在内存里；gzip 压缩也是边读边压的 Transform，同样不缓冲整个归档。
import { createGunzip, createGzip } from "node:zlib";
import { Readable } from "node:stream";

const BLOCK = 512;
const END_BLOCKS = 2;

/** 打包时的一个条目：`open()` 每次调用都要返回一个新的可读流，产出恰好 `size` 字节。 */
export type TarSourceEntry = { path: string; size: number; mtime?: number; open: () => NodeJS.ReadableStream };

/** 解包时读到的一个条目：调用方必须 `consume()` 读完（或显式 `skip()`）才能让生成器继续到下一个条目。 */
export type TarEntryHandle = {
  path: string;
  size: number;
  mtime: number;
  /** 按到达顺序把这个条目的字节交给 onChunk；读完后内部会把 512 字节边界的填充一起吃掉。
   * onChunk 可以返回一个 Promise：写盘的调用方用它等 'drain'，不等会在读得比写快时把整个文件攒进内存。 */
  consume(onChunk: (chunk: Buffer) => void | Promise<void>): Promise<void>;
  /** 不关心内容时跳过这个条目（内部仍会读完，只是丢弃）。 */
  skip(): Promise<void>;
};

function pad512(size: number): number {
  const rem = size % BLOCK;
  return rem === 0 ? 0 : BLOCK - rem;
}

/** ustar 头：路径超过 100 字节时按最后一个能让 name ≤100、prefix ≤155 的 `/` 拆成 prefix+name。 */
function ustarHeader(entryPath: string, size: number, mtimeSec: number): Buffer {
  let name = Buffer.from(entryPath, "utf8");
  let prefix = Buffer.alloc(0);
  if (name.length > 100) {
    let split = -1;
    for (let i = entryPath.length - 1; i >= 0; i--) {
      if (entryPath[i] !== "/") continue;
      const namePart = Buffer.from(entryPath.slice(i + 1), "utf8");
      const prefixPart = Buffer.from(entryPath.slice(0, i), "utf8");
      if (namePart.length <= 100 && prefixPart.length <= 155) { split = i; name = namePart; prefix = prefixPart; break; }
    }
    if (split === -1) throw new Error(`tar 条目路径无法拆进 ustar 的 name/prefix 字段：${entryPath}`);
  }
  const header = Buffer.alloc(BLOCK);
  const writeBytes = (value: Buffer, offset: number, length: number) => value.copy(header, offset, 0, Math.min(value.length, length));
  const writeOctal = (value: number, offset: number, length: number) => {
    header.write(value.toString(8).padStart(length - 1, "0"), offset, length - 1, "ascii");
    header[offset + length - 1] = 0;
  };
  writeBytes(name, 0, 100);
  writeOctal(0o644, 100, 8); // mode
  writeOctal(0, 108, 8); // uid
  writeOctal(0, 116, 8); // gid
  writeOctal(size, 124, 12);
  writeOctal(mtimeSec, 136, 12);
  header.write("        ", 148, 8, "ascii"); // chksum 占位：计算时当作 8 个空格
  header[156] = 0x30; // typeflag '0'：普通文件
  header.write("ustar\0", 257, 6, "ascii");
  header.write("00", 263, 2, "ascii");
  writeOctal(0, 329, 8); // devmajor
  writeOctal(0, 337, 8); // devminor
  writeBytes(prefix, 345, 155);
  let sum = 0;
  for (let i = 0; i < BLOCK; i++) sum += header[i];
  header.write(sum.toString(8).padStart(6, "0"), 148, 6, "ascii");
  header[154] = 0;
  header[155] = 0x20;
  return header;
}

async function* rawTarBytes(entries: TarSourceEntry[]): AsyncGenerator<Buffer> {
  const nowSec = Math.floor(Date.now() / 1000);
  for (const entry of entries) {
    if (entry.size < 0 || !Number.isInteger(entry.size)) throw new Error(`tar 条目 ${entry.path} 的 size 不合法`);
    yield ustarHeader(entry.path, entry.size, entry.mtime ?? nowSec);
    let written = 0;
    for await (const chunk of entry.open() as AsyncIterable<Buffer>) {
      written += chunk.length;
      yield chunk;
    }
    if (written !== entry.size) throw new Error(`tar 条目 ${entry.path}：声明 ${entry.size} 字节，实际写入 ${written} 字节`);
    const padLen = pad512(entry.size);
    if (padLen) yield Buffer.alloc(padLen);
  }
  yield Buffer.alloc(BLOCK * END_BLOCKS);
}

/** 打一个 gzip 压缩的 tar 流：返回的 Readable 边读源文件边产出字节，不缓冲整个归档。 */
export function packTarGz(entries: TarSourceEntry[]): NodeJS.ReadableStream {
  const raw = Readable.from(rawTarBytes(entries));
  const gzip = createGzip();
  raw.on("error", error => gzip.destroy(error));
  gzip.on("close", () => raw.destroy());
  return raw.pipe(gzip);
}

/**
 * 从一串 Buffer 异步迭代器里按需取出恰好 n 字节；只缓冲还没被取走的尾部，不缓冲整条流。
 * 不用构造函数参数属性（`constructor(private x: T)`）：scripts/backup-restore.mjs 直接按
 * Node 原生的类型剥离加载这个文件，那种写法剥不掉类型之外还隐含了赋值语句，Node 不支持
 * （和 lib/site-package.ts 顶部注释的约束一样）。
 */
class ByteReader {
  private readonly source: AsyncIterator<Buffer>;
  private queue: Buffer[] = [];
  private queued = 0;
  private ended = false;
  constructor(source: AsyncIterator<Buffer>) {
    this.source = source;
  }
  private async fill(n: number) {
    while (this.queued < n && !this.ended) {
      const { value, done } = await this.source.next();
      if (done) { this.ended = true; break; }
      this.queue.push(value);
      this.queued += value.length;
    }
  }
  /** 读不到 n 字节时：队列里一点剩余都没有返回 null（正常结束），否则是流被截断，抛错。 */
  async read(n: number): Promise<Buffer | null> {
    if (n === 0) return Buffer.alloc(0);
    await this.fill(n);
    if (this.queued < n) {
      if (this.queued === 0) return null;
      throw new Error("tar 流在一个条目中间结束，归档不完整");
    }
    const combined = this.queue.length === 1 ? this.queue[0] : Buffer.concat(this.queue, this.queued);
    this.queue = combined.length > n ? [combined.subarray(n)] : [];
    this.queued = combined.length - n;
    return combined.subarray(0, n);
  }
}

function readCString(buffer: Buffer): string {
  const end = buffer.indexOf(0);
  return buffer.subarray(0, end === -1 ? buffer.length : end).toString("utf8");
}

/** 按 ustar 头解出来的一个条目；只读需要的字段，不校验 checksum（gzip 已经保证了传输完整性）。 */
export async function* unpackTarGz(source: NodeJS.ReadableStream): AsyncGenerator<TarEntryHandle> {
  const gunzip = createGunzip();
  source.pipe(gunzip);
  const reader = new ByteReader(gunzip[Symbol.asyncIterator]());
  let previousDone: (() => Promise<void>) | null = null;
  while (true) {
    if (previousDone) await previousDone();
    const header = await reader.read(BLOCK);
    if (!header || header.every(byte => byte === 0)) break;
    const name = readCString(header.subarray(0, 100));
    const prefix = readCString(header.subarray(345, 500));
    const sizeOctal = readCString(header.subarray(124, 136)).trim();
    const mtimeOctal = readCString(header.subarray(136, 148)).trim();
    const size = sizeOctal ? parseInt(sizeOctal, 8) : 0;
    const mtime = mtimeOctal ? parseInt(mtimeOctal, 8) : 0;
    const path = prefix ? `${prefix}/${name}` : name;
    let done = false;
    const consume = async (onChunk: (chunk: Buffer) => void | Promise<void>) => {
      if (done) throw new Error(`tar 条目 ${path} 已经被读过`);
      done = true;
      let remaining = size;
      while (remaining > 0) {
        const chunk = await reader.read(Math.min(remaining, 64 * 1024));
        if (!chunk) throw new Error(`tar 条目 ${path} 读到一半流就结束了`);
        // 等 onChunk 的返回值（写盘一方要用它等 'drain'）：不等就会在读得比写快时把整个文件攒在内存里。
        await onChunk(chunk);
        remaining -= chunk.length;
      }
      const padLen = pad512(size);
      if (padLen) await reader.read(padLen);
    };
    previousDone = async () => { if (!done) await consume(() => {}); };
    yield { path, size, mtime, consume, skip: () => consume(() => {}) };
  }
}
