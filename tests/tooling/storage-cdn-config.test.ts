import { describe, expect, it } from 'vitest';
import { execFile, execFileSync, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// 香港对象存储/CDN 的配置模板与合同文档（#297）：真实凭据只存在于目标机与凭据库，
// 仓库里任何一份文件把密钥贴回来，都等于把一台公网机器的管理通道写进历史。
const root = fileURLToPath(new URL('../..', import.meta.url));
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const MODULE_DIR = 'deploy/storage-cdn';
const CONTRACT = 'docs/ops/STORAGE-CDN.md';

// 递归收集模块下的所有文本文件：新增一个配置文件就自动纳入扫描，不用记得来改这份清单。
function moduleFiles(dir = MODULE_DIR): string[] {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    return entry.isDirectory() ? moduleFiles(path) : [path];
  });
}

const SECRET_SHAPES: Array<[string, RegExp]> = [
  ['AWS/Garage access key', /\b(AKIA[0-9A-Z]{16}|GK[0-9a-f]{20,})\b/],
  ['64 位十六进制密钥', /\b[0-9a-f]{64}\b/],
  ['44 字符 base64 令牌', /(?:^|[^A-Za-z0-9+/])[A-Za-z0-9+/]{43}=(?![A-Za-z0-9+/])/],
  ['bcrypt 口令哈希', /\$2[aby]\$\d{2}\$[./A-Za-z0-9]{50,}/],
  ['私钥块', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
];

describe('storage-cdn 的每个文件都不含凭据', () => {
  it('模块下的模板与示例脚本里没有密钥形状的值', () => {
    const files = moduleFiles();
    expect(files.length, '模块下应当至少有 4 个文件').toBeGreaterThanOrEqual(4);
    for (const path of files) {
      const text = read(path);
      for (const [label, pattern] of SECRET_SHAPES) expect(pattern.test(text), `${path} 命中 ${label}`).toBe(false);
    }
  });

  it('合同文档里也没有密钥形状的值', () => {
    const text = read(CONTRACT);
    for (const [label, pattern] of SECRET_SHAPES) expect(pattern.test(text), `${CONTRACT} 命中 ${label}`).toBe(false);
  });

  it('三个 Garage 秘密字段与两个 S3 秘密字段都留空，其余值照实预填', () => {
    const garage = read(`${MODULE_DIR}/garage.toml`);
    for (const key of ['rpc_secret', 'admin_token', 'metrics_token']) {
      expect(garage, `garage.toml 的 ${key}`).toMatch(new RegExp(`^${key} = ""$`, 'm'));
    }

    const env = read(`${MODULE_DIR}/s3manager.env`);
    for (const key of ['ACCESS_KEY_ID', 'SECRET_ACCESS_KEY']) {
      expect(env, `s3manager.env 的 ${key}`).toMatch(new RegExp(`^${key}=$`, 'm'));
    }
    // 非密值必须在模板里就是真值，否则部署的人得再猜一遍。
    expect(env).toContain('ENDPOINT=cdn.yangtzeu.work');
    expect(env).toContain('REGION=garage');
    expect(env).toContain('BUCKET_LOOKUP=Path');
  });

  it('控制台口令哈希只经环境变量引用，三个 basic_auth 块一致', () => {
    const caddy = read(`${MODULE_DIR}/Caddyfile`);
    expect(caddy).toContain('{$S3MANAGER_ADMIN_HASH}');
    expect(caddy.match(/basic_auth \{/g)?.length, 'basic_auth 块数量').toBe(3);
    // 三块都写同一个变量，不能有一块留了别的口令来源
    expect(caddy.match(/admin \{\$S3MANAGER_ADMIN_HASH\}/g)?.length, '使用同一个哈希变量的块数量').toBe(3);
  });
});

describe('Caddy 拓扑与 Garage 的声明一致，顺序不被悄悄调换', () => {
  it('每个反代目标都在 Garage 声明的回环端口里，或是合同服务表里的控制台端口', () => {
    const caddy = read(`${MODULE_DIR}/Caddyfile`);
    const garage = read(`${MODULE_DIR}/garage.toml`);
    const doc = read(CONTRACT);
    const garagePorts = [...garage.matchAll(/127\.0\.0\.1:(\d+)/g)].map((match) => match[1]);
    const upstreams = [...new Set([...caddy.matchAll(/reverse_proxy\s+127\.0\.0\.1:(\d+)/g)].map((match) => match[1]))];

    expect(upstreams.sort()).toEqual(['3900', '3902', '8080', '8081']);
    for (const port of upstreams) {
      // 3900/3902 来自 garage.toml；8080/8081 是控制台与策略桥接，必须在合同的服务表里出现
      const declaredSomewhere = garagePorts.includes(port) || doc.includes(`127.0.0.1:${port}`);
      expect(declaredSomewhere, `端口 ${port} 没有在 garage.toml 或合同文档里声明`).toBe(true);
    }
  });

  it('公共对象只认公共桶，控制台路径不会被改写成存储请求', () => {
    const caddy = read(`${MODULE_DIR}/Caddyfile`);
    expect(caddy).toContain('path_regexp obj ^/(cdn|geek-public)/(.*)$');
  });

  it('公共直链补了 CORS：跨域字体与 HLS 分片缺它就会被浏览器拦下', () => {
    // s3_web 不回 Access-Control-*；站点从 yangtzeu.work 取 @font-face 与 hls.js 的 XHR 时必须有。
    // 七牛那边是默认带的（access-control-allow-origin: *），换到这台要显式写，写在公共对象段里，
    // 不能漏到控制台或 S3 签名路由上（那两条不该对外开 CORS）。
    const caddy = read(`${MODULE_DIR}/Caddyfile`);
    const publicBlock = caddy.slice(caddy.indexOf('handle @public_objects'), caddy.indexOf('# 5. 兜底进控制台'));
    expect(publicBlock).toContain('Access-Control-Allow-Origin "*"');
    expect(publicBlock).toContain('Access-Control-Expose-Headers "ETag, Content-Length, Content-Range, Accept-Ranges"');
    // 预检由 Caddy 直接 204，不转给 s3_web（它不处理 OPTIONS）
    expect(publicBlock).toMatch(/@preflight method OPTIONS/);
    expect(publicBlock).toMatch(/respond @preflight 204/);
    expect(publicBlock).toContain('Access-Control-Allow-Headers "Range, If-None-Match, If-Modified-Since"');
    // 全文里只有这两处（预检一份、正常响应一份）
    expect(caddy.match(/Access-Control-Allow-Origin/g)?.length, 'ACAO 出现次数').toBe(2);
  });

  it('handle 块按文件顺序生效：S3 → 桶策略 → 控制台 → 公共对象 → 兜底', () => {
    // Caddy 的 handle 组按配置里的先后匹配（caddy adapt 实测），顺序被调换就能让 /Default 落进存储路由。
    const caddy = read(`${MODULE_DIR}/Caddyfile`);
    const order = ['@s3_auth', '@policy_route', '@console_routes', '@public_objects', 'handle {'];
    const positions = order.map((needle) => caddy.indexOf(`handle ${needle}`) >= 0 ? caddy.indexOf(`handle ${needle}`) : caddy.lastIndexOf(needle));
    for (let index = 1; index < positions.length; index += 1) {
      expect(positions[index], `${order[index]} 必须排在 ${order[index - 1]} 之后`).toBeGreaterThan(positions[index - 1]);
    }
  });

  it('合同文档列出的桶与端口覆盖模板实际用到的', () => {
    const doc = read(CONTRACT);
    for (const port of ['3900', '3901', '3902', '3903', '8080', '8081']) expect(doc, `端口 ${port}`).toContain(port);
    for (const bucket of ['cdn', 'geek-public', 'geek-production-private', 'geek-preview-private', 'geek-backup']) {
      expect(doc, `桶 ${bucket}`).toContain(bucket);
    }
    // 备份桶不写成「已有代码在写」：归档器在实际合入之前不能当成现行事实。
    expect(doc).toContain('目前没有任何代码写它');
  });
});

describe('示例上传脚本不保存凭据，失败要能被调用方看见', () => {
  const script = join(root, `${MODULE_DIR}/scripts/upload_demo.py`);
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

  it('端点返回 501 时以非零退出并打印 [FAILED]（修复前这里是 0）', async () => {
    // 必须是「连得上但被拒」：连不上是 URLError，修复前后都非零，钉不住 sys.exit(1)。
    const server = createServer((_request, response) => {
      response.writeHead(501);
      response.end('not implemented');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('本地 501 服务没有拿到端口');

    const result = await new Promise<{ code: number | null; stdout: string }>((resolve) => {
      execFile(
        python,
        [script, join(root, 'README.md')],
        {
          encoding: 'utf8',
          env: {
            PATH: process.env.PATH ?? '',
            HOME: process.env.HOME ?? '',
            S3_ACCESS_KEY_ID: 'synthetic',
            S3_SECRET_KEY: 'synthetic',
            S3_ENDPOINT: `http://127.0.0.1:${address.port}`,
          },
        },
        (error, stdout) => resolve({ code: error ? (typeof error.code === 'number' ? error.code : 1) : 0, stdout }),
      );
    });
    await new Promise<void>((resolve) => server.close(() => resolve()));

    expect(result.code, '上传被拒必须非零退出').not.toBe(0);
    expect(result.stdout).toContain('[FAILED]');
  });
});
