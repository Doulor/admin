import { describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// 香港对象存储/CDN 的配置模板与合同文档（#297）：这套系统的真实凭据只存在于目标机与凭据库，
// 仓库里的模板一旦把密钥、口令哈希贴回来，就等于把一台公网机器的管理通道写进公开历史。
const root = fileURLToPath(new URL('../..', import.meta.url));
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const TEMPLATES = {
  garage: 'deploy/storage-cdn/garage.toml',
  s3manager: 'deploy/storage-cdn/s3manager.env',
  caddy: 'deploy/storage-cdn/Caddyfile',
  doc: 'docs/ops/STORAGE-CDN.md',
} as const;

const SECRET_SHAPES: Array<[string, RegExp]> = [
  ['AWS/Garage access key', /\b(AKIA[0-9A-Z]{16}|GK[0-9a-f]{20,})\b/],
  ['64 位十六进制密钥', /\b[0-9a-f]{64}\b/],
  ['bcrypt 口令哈希', /\$2[aby]\$\d{2}\$[./A-Za-z0-9]{50,}/],
  ['私钥块', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
];

describe('storage-cdn 模板不含任何凭据', () => {
  it.each(Object.entries(TEMPLATES))('%s 里没有密钥形状的值', (_name, path) => {
    const text = read(path);
    for (const [label, pattern] of SECRET_SHAPES) expect(pattern.test(text), `${path} 命中 ${label}`).toBe(false);
  });

  it('三个 Garage 秘密字段与两个 S3 秘密字段都留空，其余值照实预填', () => {
    const garage = read(TEMPLATES.garage);
    for (const key of ['rpc_secret', 'admin_token', 'metrics_token']) {
      expect(garage, `garage.toml 的 ${key}`).toMatch(new RegExp(`^${key} = ""$`, 'm'));
    }

    const env = read(TEMPLATES.s3manager);
    for (const key of ['ACCESS_KEY_ID', 'SECRET_ACCESS_KEY']) {
      expect(env, `s3manager.env 的 ${key}`).toMatch(new RegExp(`^${key}=$`, 'm'));
    }
    // 非密值必须在模板里就是真值，否则部署的人得再猜一遍。
    expect(env).toContain('ENDPOINT=cdn.yangtzeu.work');
    expect(env).toContain('REGION=garage');
    expect(env).toContain('BUCKET_LOOKUP=Path');
  });

  it('控制台口令哈希只经环境变量引用，不在文件里', () => {
    const caddy = read(TEMPLATES.caddy);
    expect(caddy).toContain('{$S3MANAGER_ADMIN_HASH}');
    expect(caddy.match(/basic_auth \{/g)?.length, 'basic_auth 块数量').toBe(3);
  });
});

describe('Caddy 路由与 Garage 端口保持同一套拓扑', () => {
  it('Caddy 只反代模板里声明的那几个回环端口，且每个 upstream 都能在 garage.toml 或服务表里找到', () => {
    const caddy = read(TEMPLATES.caddy);
    const upstreams = [...caddy.matchAll(/reverse_proxy\s+127\.0\.0\.1:(\d+)/g)].map((match) => match[1]);
    expect([...new Set(upstreams)].sort()).toEqual(['3900', '3902', '8080', '8081']);

    const garage = read(TEMPLATES.garage);
    expect(garage).toContain('api_bind_addr = "127.0.0.1:3900"');
    expect(garage).toContain('bind_addr = "127.0.0.1:3902"');
    expect(garage).toContain('rpc_bind_addr = "127.0.0.1:3901"');
    expect(garage).toContain('127.0.0.1:3903');
  });

  it('合同文档列出的端口与桶覆盖模板里实际用到的，不写另一套', () => {
    const doc = read(TEMPLATES.doc);
    for (const port of ['3900', '3901', '3902', '3903', '8080', '8081']) expect(doc, `端口 ${port}`).toContain(port);
    for (const bucket of ['cdn', 'geek-public', 'geek-production-private', 'geek-preview-private', 'geek-backup']) {
      expect(doc, `桶 ${bucket}`).toContain(bucket);
    }
    // 归档器写哪个桶由它自己的回归守住（deploy/remote/garage-archive.mjs 的测试）；这里只要求合同把同一个桶名写死，
    // 两份说明不能各说一套。
    expect(doc).toMatch(/`geek-backup`[^\n]*备份归档|备份归档[^\n]*`geek-backup`/);
  });
});

describe('示例上传脚本不保存凭据', () => {
  const script = join(root, 'deploy/storage-cdn/scripts/upload_demo.py');
  const python = execFileSync('sh', ['-c', 'command -v python3'], { encoding: 'utf8' }).trim();

  it('缺凭据时直接失败并说明从哪来，而不是用文件里的默认值', () => {
    const result = spawnSync(python, [script, join(root, 'README.md')], {
      encoding: 'utf8',
      env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '' },
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('S3_ACCESS_KEY_ID');
    expect(result.stdout).toBe('');
  });

  it('用法错误时打印用法并以非零退出', () => {
    const result = spawnSync(python, [script], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('用法');
  });
});
