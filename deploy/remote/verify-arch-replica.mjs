#!/usr/bin/env node
// 启动 Arch 副本前只读核验 env 和复制库；不修写 gitlab_settings，也不授予部署或外发许可。
import { closeSync, lstatSync, openSync, readFileSync, readSync, statSync } from 'node:fs';
import { EXPECTED_ORIGINS, parseEnvFileText } from '../../scripts/deployment-environment.mjs';

let failure = '用法：verify-arch-replica.mjs --environment <production|preview> --env-file <文件> --database <复制库>';
try {
  const args = process.argv.slice(2);
  const options = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    if (!['--environment', '--env-file', '--database'].includes(key) || options.has(key) || !args[index + 1]) throw new Error();
    options.set(key, args[index + 1]);
  }
  const environment = options.get('--environment');
  if (options.size !== 3 || !['production', 'preview'].includes(environment)) throw new Error();

  failure = '运行配置无法读取或解析；副本核验未通过';
  const values = parseEnvFileText(readFileSync(options.get('--env-file'), 'utf8'));
  const port = environment === 'production' ? 18100 : 18200;
  const imageTag = environment === 'production' ? 'd4a24749d077' : '02cb751c0b83';
  const origin = EXPECTED_ORIGINS[environment];
  const expected = new Map([
    ['GEEK_DEPLOYMENT_ENVIRONMENT', environment], ['GEEK_ENVIRONMENT_ORIGIN', origin], ['PUBLIC_ORIGIN', origin],
    ['COMPOSE_PROJECT_NAME', `yzgc-${environment}`], ['STACK_ROOT', `/opt/yzgc/${environment}`],
    ['IMAGE_TAG', imageTag], ['WEB_BIND', `10.66.0.2:${port}`], ['SERVER_BIND', `127.0.0.1:${port + 1}`], ['TRUST_PROXY', '2'],
    ['GITLAB_SYNC', 'off'], ['MAIL_RECIPIENTS', 'allowlist'], ['MAIL_ALLOWLIST', ''],
  ]);
  failure = '运行配置的环境、既有版本、bind 或外发隔离不符合本次副本合同；拒绝启动';
  if ([...expected].some(([key, value]) => values.get(key) !== value)) throw new Error();
  failure = '缺少非空 ENCRYPTION_KEY；无法核验依赖原加密密钥的副本配置，拒绝启动';
  if (!values.get('ENCRYPTION_KEY')?.trim()) throw new Error();

  failure = '复制库不存在、不可读或不是可核验的 SQLite 库；拒绝启动';
  const path = options.get('--database');
  const info = statSync(path);
  if (!info.isFile() || info.size < 100) throw new Error();
  const header = Buffer.alloc(20);
  const fd = openSync(path, 'r');
  try { readSync(fd, header, 0, header.length, 0); } finally { closeSync(fd); }
  if (header.toString('utf8', 0, 16) !== 'SQLite format 3\0') throw new Error();
  // SQLite 的 readOnly 连接仍会写 SHM 读标记；只核验已完成一致恢复的独立快照，不能用 immutable 忽略 WAL。
  failure = '复制库仍有 WAL/SHM/journal 状态；请先按恢复合同准备独立一致快照，核验器不会修写复制库';
  if (header[18] !== 1 || header[19] !== 1 || ['-wal', '-shm', '-journal'].some(suffix => lstatSync(`${path}${suffix}`, { throwIfNoEntry: false }))) throw new Error();
  failure = '复制库不存在、不可读或不是可核验的 SQLite 库；拒绝启动';
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(path, { readOnly: true });
  let persistedMode = 'absent';
  try {
    const state = db.prepare("SELECT type FROM sqlite_schema WHERE name = 'app_state'").get();
    if (state) {
      if (state.type !== 'table') throw new Error();
      const rows = db.prepare("SELECT value FROM app_state WHERE key = 'gitlab_settings' LIMIT 2").all();
      if (rows.length > 1) throw new Error();
      if (rows.length) {
        failure = '复制库 GitLab 持久设置无效或会覆盖 env 的关闭状态；拒绝启动，需另行授权处理复制库';
        const settings = JSON.parse(rows[0].value);
        if (!settings || typeof settings !== 'object' || Array.isArray(settings) || (settings.mode !== undefined && settings.mode !== 'off')) throw new Error();
        persistedMode = settings.mode === 'off' ? 'off' : 'absent';
      }
    }
  } finally {
    db.close();
  }
  console.log(JSON.stringify({
    environment, image_tag: imageTag, replica_verified: true, gitlab_sync: 'off', persisted_gitlab_mode: persistedMode,
    scope: 'configuration', encryption_key_match_verified: false,
    mail_recipients: 'allowlist', mail_allowlist_empty: true,
  }));
  console.error('仅核验配置与持久关闭状态；ENCRYPTION_KEY 是否匹配仍须与原快照对应的原密钥核对。');
} catch {
  // 不打印底层异常：解析器、文件系统和 SQLite 错误可能带入 env 原行或持久值。
  console.error(failure);
  process.exitCode = 1;
}
