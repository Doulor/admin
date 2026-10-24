// lib/tar-stream.ts（#282）：打包/解包要互为逆操作，长路径的 ustar name/prefix 拆分和不消费条目时的
// 自动跳过也要对。
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { packTarGz, unpackTarGz } from '../../app/server/src/lib/tar-stream';

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const parts: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer>) parts.push(chunk);
  return Buffer.concat(parts);
}

async function readEntry(entry: { consume(onChunk: (chunk: Buffer) => void): Promise<void> }): Promise<Buffer> {
  const parts: Buffer[] = [];
  await entry.consume(chunk => parts.push(chunk));
  return Buffer.concat(parts);
}

describe('tar-stream（#282 一键备份用的流式 tar+gzip）', () => {
  it('打包再解包：路径、大小、mtime、内容原样还原', async () => {
    const files = [
      { path: 'manifest.json', data: Buffer.from('{"a":1}') },
      { path: 'data.db', data: Buffer.alloc(5000, 7) }, // 跨多个 512 字节块
      { path: 'sites/comp-1/version-1/index.html', data: Buffer.from('<html></html>') },
    ];
    const mtime = 1_700_000_000;
    const gz = packTarGz(files.map(f => ({ path: f.path, size: f.data.length, mtime, open: () => Readable.from([f.data]) })));

    const seen: { path: string; size: number; mtime: number; data: Buffer }[] = [];
    for await (const entry of unpackTarGz(gz)) {
      seen.push({ path: entry.path, size: entry.size, mtime: entry.mtime, data: await readEntry(entry) });
    }
    expect(seen.map(e => e.path)).toEqual(files.map(f => f.path));
    for (let i = 0; i < files.length; i++) {
      expect(seen[i].size).toBe(files[i].data.length);
      expect(seen[i].mtime).toBe(mtime);
      expect(seen[i].data.equals(files[i].data)).toBe(true);
    }
  });

  it('路径超过 100 字节时按 ustar 的 name/prefix 拆分，仍然能原样解回来', async () => {
    const longDir = 'sites/' + 'a1b2c3d4-e5f6-7890-abcd-ef1234567890/'.repeat(2) + 'b1c2d3e4-f5a6-7890-abcd-ef1234567890';
    const path = `${longDir}/assets/some/pretty/deeply/nested/page.html`;
    expect(Buffer.byteLength(path, 'utf8')).toBeGreaterThan(100);
    const data = Buffer.from('nested file');
    const gz = packTarGz([{ path, size: data.length, open: () => Readable.from([data]) }]);
    const entries: string[] = [];
    for await (const entry of unpackTarGz(gz)) {
      entries.push(entry.path);
      const got = await readEntry(entry);
      expect(got.equals(data)).toBe(true);
    }
    expect(entries).toEqual([path]);
  });

  it('不消费某个条目时生成器自动跳过它，后续条目仍能正常读到', async () => {
    const a = Buffer.from('first');
    const b = Buffer.from('second, a bit longer than the first one');
    const gz = packTarGz([
      { path: 'a.txt', size: a.length, open: () => Readable.from([a]) },
      { path: 'b.txt', size: b.length, open: () => Readable.from([b]) },
    ]);
    const paths: string[] = [];
    let secondData: Buffer | null = null;
    for await (const entry of unpackTarGz(gz)) {
      paths.push(entry.path);
      if (entry.path === 'b.txt') secondData = await readEntry(entry);
      // a.txt 故意不调用 consume/skip，靠生成器自己在下一次 next() 之前吃掉它
    }
    expect(paths).toEqual(['a.txt', 'b.txt']);
    expect(secondData?.equals(b)).toBe(true);
  });

  it('条目实际写出的字节数和声明的 size 不一致时，打包阶段直接抛错', async () => {
    const stream = packTarGz([{ path: 'bad.txt', size: 10, open: () => Readable.from([Buffer.from('short')]) }]);
    await expect(streamToBuffer(stream)).rejects.toThrow(/声明 10 字节/);
  });
});
