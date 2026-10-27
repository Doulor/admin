#!/usr/bin/env node
// Garage 私有归档适配器：复用 rclone 的 S3/SigV4 实现，只新增、完整读回核验，不提供覆盖或删除命令。
import { createHash } from 'node:crypto';
import {
  createReadStream, createWriteStream, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync,
} from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { basename, dirname, isAbsolute, join, normalize, relative, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { fileURLToPath } from 'node:url';

const ENDPOINT = 'https://cdn.yangtzeu.work';
const REGION = 'garage';
const REMOTE = 'geekgarage';
const ROLES = Object.freeze({
  'gitlab-backup': {
    bucket: 'geek-backup', access: 'GITLAB_BACKUP_S3_ACCESS_KEY_ID', secret: 'GITLAB_BACKUP_S3_SECRET_ACCESS_KEY',
    key: /^gitlab\/\d{4}-\d{2}-\d{2}\/[A-Za-z0-9._-]+\/[A-Za-z0-9._/-]+$/,
    prefix: /^gitlab\/(?:\d{4}-\d{2}-\d{2}\/[A-Za-z0-9._-]+\/?)?$/,
  },
  'platform-preview-backup': {
    bucket: 'geek-backup', access: 'PLATFORM_PREVIEW_BACKUP_S3_ACCESS_KEY_ID', secret: 'PLATFORM_PREVIEW_BACKUP_S3_SECRET_ACCESS_KEY',
    key: /^platform\/preview\/\d{4}-\d{2}-\d{2}\/[A-Za-z0-9._-]+\/[A-Za-z0-9._/-]+$/,
    prefix: /^platform\/preview\/\d{4}-\d{2}-\d{2}\/[A-Za-z0-9._-]+\/$/,
  },
  'platform-production-backup': {
    bucket: 'geek-backup', access: 'PLATFORM_PRODUCTION_BACKUP_S3_ACCESS_KEY_ID', secret: 'PLATFORM_PRODUCTION_BACKUP_S3_SECRET_ACCESS_KEY',
    key: /^platform\/production\/\d{4}-\d{2}-\d{2}\/[A-Za-z0-9._-]+\/[A-Za-z0-9._/-]+$/,
    prefix: /^platform\/production\/\d{4}-\d{2}-\d{2}\/[A-Za-z0-9._-]+\/$/,
  },
  'preview-content-index': {
    bucket: 'geek-preview-private', access: 'PREVIEW_PRIVATE_INDEX_S3_ACCESS_KEY_ID', secret: 'PREVIEW_PRIVATE_INDEX_S3_SECRET_ACCESS_KEY',
    key: /^indexes\/content\/[0-9a-f]{40}\/sha256\.json$/,
  },
  'production-content-index': {
    bucket: 'geek-production-private', access: 'PRODUCTION_PRIVATE_INDEX_S3_ACCESS_KEY_ID', secret: 'PRODUCTION_PRIVATE_INDEX_S3_SECRET_ACCESS_KEY',
    key: /^indexes\/content\/[0-9a-f]{40}\/sha256\.json$/,
  },
});

class ArchiveError extends Error {}
const requireThat = (condition, message) => { if (!condition) throw new ArchiveError(message); };

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const allowedByCommand = {
    'put-tree': ['--role', '--source', '--prefix'],
    'put-file': ['--role', '--source', '--key'],
    'get-tree': ['--role', '--prefix', '--destination'],
    'resolve-gitlab-run': ['--day'],
  };
  requireThat(Object.hasOwn(allowedByCommand, command), '用法：garage-archive.mjs put-tree|put-file|get-tree|resolve-gitlab-run');
  const allowed = new Set(allowedByCommand[command]);
  const options = Object.create(null);
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    const value = rest[index + 1];
    requireThat(allowed.has(key) && value && !Object.hasOwn(options, key), '参数缺失、重复或未知');
    options[key] = value;
  }
  const requiredByCommand = {
    'put-tree': ['--role', '--source', '--prefix'],
    'put-file': ['--role', '--source', '--key'],
    'get-tree': ['--role', '--prefix', '--destination'],
    'resolve-gitlab-run': [],
  };
  for (const key of requiredByCommand[command]) requireThat(options[key], `缺少 ${key}`);
  return { command, options };
}

function assertLocalPath(path, { mustExist = true } = {}) {
  requireThat(typeof path === 'string' && isAbsolute(path) && normalize(path) === path && path !== '/', '本地路径必须是规范安全绝对路径');
  const resolved = realpathSync(mustExist ? path : dirname(path));
  const checked = mustExist ? resolved : join(resolved, basename(path));
  const root = process.platform === 'darwin' && checked.startsWith('/private/') ? '/private' : sep;
  let current = root;
  const parts = checked.slice(root.length).split(sep).filter(Boolean);
  for (let index = 0; index < parts.length - (mustExist ? 0 : 1); index += 1) {
    current = join(current, parts[index]);
    const info = lstatSync(current);
    requireThat(!info.isSymbolicLink(), '本地路径不得经过符号链接');
  }
  if (mustExist) requireThat(existsSync(checked), '本地路径不存在');
  return checked;
}

function assertObjectPath(role, key, kind = 'key') {
  requireThat(typeof key === 'string' && key.length <= 512 && !key.includes('\\') && !key.includes('%') && !key.includes('?') && !key.includes('#')
    && !key.split('/').some(part => part === '.' || part === '..'), '对象路径含非法字符');
  const pattern = kind === 'prefix' ? role.prefix : role.key;
  requireThat(pattern?.test(key), `对象${kind === 'prefix' ? '前缀' : '键'}不在角色允许范围`);
  return key;
}

function roleConfig(name, env = process.env) {
  const role = ROLES[name];
  requireThat(role, '未知归档角色');
  const access = env[role.access] ?? '';
  const secret = env[role.secret] ?? '';
  requireThat(access && !/[\s:\x00-\x1f\x7f]/.test(access), `缺少或非法 ${role.access}`);
  requireThat(secret && !/[\x00-\x1f\x7f]/.test(secret), `缺少或非法 ${role.secret}`);
  const childEnv = {
    PATH: env.PATH ?? '/usr/bin:/bin', HOME: env.HOME ?? '/', LANG: 'C.UTF-8',
    ...(env.FAKE_RCLONE_FAIL ? { FAKE_RCLONE_FAIL: env.FAKE_RCLONE_FAIL } : {}),
    ...(env.FAKE_RCLONE_OBJECTS ? { FAKE_RCLONE_OBJECTS: env.FAKE_RCLONE_OBJECTS } : {}),
    ...(env.FAKE_RCLONE_LOG ? { FAKE_RCLONE_LOG: env.FAKE_RCLONE_LOG } : {}),
    RCLONE_CONFIG_GEEKGARAGE_TYPE: 's3', RCLONE_CONFIG_GEEKGARAGE_PROVIDER: 'Other',
    RCLONE_CONFIG_GEEKGARAGE_ACCESS_KEY_ID: access, RCLONE_CONFIG_GEEKGARAGE_SECRET_ACCESS_KEY: secret,
    RCLONE_CONFIG_GEEKGARAGE_REGION: REGION, RCLONE_CONFIG_GEEKGARAGE_ENDPOINT: ENDPOINT,
    RCLONE_CONFIG_GEEKGARAGE_FORCE_PATH_STYLE: 'true', RCLONE_CONFIG_GEEKGARAGE_NO_CHECK_BUCKET: 'true',
  };
  return { ...role, name, childEnv };
}

const remotePath = (role, key) => `${REMOTE}:${role.bucket}/${key}`;

function runJson(args, role, { missingOk = false } = {}) {
  const result = spawnSync('rclone', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, env: role.childEnv });
  if (missingOk && result.status === 3) return null;
  requireThat(result.status === 0 && !result.error, `rclone ${args[0]} 失败`);
  try { return JSON.parse(result.stdout); } catch { throw new ArchiveError(`rclone ${args[0]} 返回无效 JSON`); }
}

async function streamRclone(args, role, output) {
  const child = spawn('rclone', args, { env: role.childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
  const hash = createHash('sha256');
  let bytes = 0;
  const meter = new Transform({ transform(chunk, _encoding, callback) { bytes += chunk.length; hash.update(chunk); callback(null, chunk); } });
  const sink = output ? createWriteStream(output, { flags: 'wx', mode: 0o600 }) : new Transform({ transform(_chunk, _encoding, callback) { callback(); } });
  child.stderr.on('data', () => {});
  const closed = new Promise((resolvePromise, rejectPromise) => {
    child.on('error', () => rejectPromise(new ArchiveError(`rclone ${args[0]} 启动失败`)));
    child.on('close', resolvePromise);
  });
  let code;
  try { [, code] = await Promise.all([pipeline(child.stdout, meter, sink), closed]); }
  catch { child.kill('SIGKILL'); throw new ArchiveError('rclone cat 读取失败'); }
  requireThat(code === 0, `rclone ${args[0]} 失败`);
  return { bytes, sha256: hash.digest('hex') };
}

async function hashFile(path) {
  const hash = createHash('sha256');
  let bytes = 0;
  for await (const chunk of createReadStream(path)) { bytes += chunk.length; hash.update(chunk); }
  return { bytes, sha256: hash.digest('hex') };
}

async function putFile(role, source, key) {
  source = assertLocalPath(source);
  const info = lstatSync(source);
  requireThat(info.isFile() && !info.isSymbolicLink() && info.nlink === 1, '上传源必须是无链接普通文件');
  assertObjectPath(role, key);
  if (role.name.endsWith('-content-index')) validateContentIndex(source, info);
  const local = await hashFile(source);
  const target = remotePath(role, key);
  const current = runJson(['lsjson', target, '--stat', '--no-modtime', '--no-mimetype'], role, { missingOk: true });
  if (current) {
    const remote = await streamRclone(['cat', target], role);
    requireThat(remote.bytes === local.bytes && remote.sha256 === local.sha256, `${key}：同键内容冲突，拒绝覆盖`);
    return { status: 'exists', key, ...local };
  }
  const copied = spawnSync('rclone', ['copyto', source, target, '--immutable', '--no-traverse', '--retries', '3', '--low-level-retries', '5', '--stats', '0'], {
    encoding: 'utf8', env: role.childEnv,
  });
  requireThat(copied.status === 0 && !copied.error, `rclone copyto ${key} 失败`);
  const saved = await streamRclone(['cat', target], role);
  requireThat(saved.bytes === local.bytes && saved.sha256 === local.sha256, `${key}：写后完整 GET SHA-256 不一致`);
  return { status: 'stored', key, ...local };
}

function collectTree(source) {
  source = assertLocalPath(source);
  requireThat(lstatSync(source).isDirectory(), 'put-tree 的 source 必须是目录');
  const files = [];
  function walk(current) {
    for (const name of readdirSync(current).sort()) {
      const path = join(current, name);
      const info = lstatSync(path);
      requireThat(!info.isSymbolicLink(), '归档目录不得包含符号链接');
      if (info.isDirectory()) walk(path);
      else {
        requireThat(info.isFile() && info.nlink === 1, '归档目录只允许无链接普通文件');
        files.push(path);
      }
    }
  }
  walk(source);
  requireThat(files.length > 0, '归档目录为空');
  return { source, files };
}

function validateContentIndex(source, info) {
  requireThat((info.mode & 0o777) === 0o600, '私有内容索引权限必须是 0600');
  let parsed;
  try { parsed = JSON.parse(readFileSync(source, 'utf8')); } catch { throw new ArchiveError('私有内容索引 JSON 无效'); }
  requireThat(parsed?.schema_version === 1 && parsed.hashes && parsed.constructor === Object && parsed.hashes.constructor === Object, '私有内容索引 schema 无效');
  for (const [digest, item] of Object.entries(parsed.hashes)) {
    requireThat(/^[0-9a-f]{64}$/.test(digest) && Number.isSafeInteger(item?.bytes) && item.bytes >= 0 && Array.isArray(item.keys)
      && item.keys.length > 0 && item.keys.every(key => typeof key === 'string' && key.length > 0), '私有内容索引条目无效');
  }
}

async function putTree(role, source, prefix) {
  assertObjectPath(role, prefix, 'prefix');
  const collected = collectTree(source);
  source = collected.source;
  const files = collected.files;
  const results = [];
  for (const file of files) {
    const rel = relative(source, file).split(sep).join('/');
    requireThat(rel && !rel.startsWith('../'), '归档相对路径非法');
    results.push(await putFile(role, file, `${prefix}${rel}`));
  }
  return {
    bucket: role.bucket, prefix, total: results.length,
    stored: results.filter(item => item.status === 'stored').length,
    exists: results.filter(item => item.status === 'exists').length,
    objects: results.map(({ key, bytes, sha256 }) => ({ key, bytes, sha256 })),
  };
}

function listPrefix(role, prefix) {
  assertObjectPath(role, prefix, 'prefix');
  const list = runJson(['lsjson', remotePath(role, prefix), '--recursive', '--files-only', '--no-modtime', '--no-mimetype'], role);
  requireThat(Array.isArray(list), 'rclone lsjson 结果无效');
  return list.map(item => {
    const path = item?.Path;
    requireThat(typeof path === 'string' && path && !path.includes('\\') && !path.includes('%') && !path.startsWith('/')
      && !path.split('/').some(part => !part || part === '.' || part === '..'), '远端对象路径非法');
    const key = `${prefix}${path}`;
    assertObjectPath(role, key);
    return { path, key, bytes: item.Size };
  }).sort((a, b) => a.path.localeCompare(b.path, 'en'));
}

async function getTree(role, prefix, destination) {
  assertObjectPath(role, prefix, 'prefix');
  destination = assertLocalPath(destination, { mustExist: false });
  requireThat(!existsSync(destination), '下载目标已存在，拒绝覆盖');
  const objects = listPrefix(role, prefix);
  requireThat(objects.length > 0, '远端前缀为空');
  mkdirSync(destination, { mode: 0o700 });
  const downloaded = [];
  for (const item of objects) {
    const path = join(destination, ...item.path.split('/'));
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    const partial = `${path}.partial`;
    const result = await streamRclone(['cat', remotePath(role, item.key)], role, partial);
    renameSync(partial, path);
    downloaded.push({ path: item.path, ...result });
  }
  return { bucket: role.bucket, prefix, downloaded: downloaded.length, objects: downloaded };
}

function resolveGitlabRun(day, env = process.env) {
  if (day) requireThat(/^\d{4}-\d{2}-\d{2}$/.test(day), '--day 必须是 YYYY-MM-DD');
  const role = roleConfig('gitlab-backup', env);
  const objects = listPrefix(role, 'gitlab/');
  const candidates = [];
  for (const item of objects) {
    let match = /^(\d{4}-\d{2}-\d{2})\/([A-Za-z0-9._-]+)\/SHA256SUMS$/.exec(item.path);
    if (match) candidates.push({ day: match[1], prefix: `gitlab/${match[1]}/${match[2]}/` });
    else if ((match = /^(\d{4}-\d{2}-\d{2})\/SHA256SUMS$/.exec(item.path))) candidates.push({ day: match[1], prefix: `gitlab/${match[1]}/` });
  }
  const filtered = candidates.filter(item => !day || item.day === day).sort((a, b) => a.prefix.localeCompare(b.prefix, 'en'));
  requireThat(filtered.length > 0, day ? `没有 ${day} 的 GitLab 归档` : '没有 GitLab 归档');
  return filtered.at(-1);
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const { command, options } = parseArgs(argv);
  if (command === 'resolve-gitlab-run') return resolveGitlabRun(options['--day'], env);
  const role = roleConfig(options['--role'], env);
  if (command === 'put-file') return { bucket: role.bucket, ...(await putFile(role, options['--source'], options['--key'])) };
  if (command === 'put-tree') return await putTree(role, options['--source'], options['--prefix']);
  if (command === 'get-tree') return await getTree(role, options['--prefix'], options['--destination']);
  throw new ArchiveError('未知命令');
}

const direct = process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (direct) main().then(result => console.log(JSON.stringify(result))).catch(error => {
  console.error(`[garage-archive] ${error instanceof ArchiveError ? error.message : '失败：本地 I/O 或 rclone 不可用'}`);
  process.exitCode = 1;
});
