#!/usr/bin/env node
// 仅在新 Arch 副本启动前运行：/config 挂当前环境栈根，/templates 只读挂两份入库模板。
// 原有密钥在目标机内保留，永不输出；这里只关闭 env 默认外发项，复制库的持久设置必须另外只读核验。
import { readFileSync, renameSync, writeFileSync } from 'node:fs';

const [environment] = process.argv.slice(2);
if (!['production', 'preview'].includes(environment)) throw new Error('需要 production 或 preview');
const file = `/config/.env.${environment}`;
const source = readFileSync(file, 'utf8');
const template = readFileSync(`/templates/.env.${environment}`, 'utf8');
// 与仓库 dotenv 合同一致地识别空白和成对引号；错误只带行号，不带可能含密钥的原行。
function parseConfiguration(text, label) {
  const values = new Map();
  const rows = text.split(/\r?\n/).map((line, index) => {
    if (!line.trim() || line.trimStart().startsWith('#')) return { line };
    const match = /^\s*([A-Z][A-Z0-9_]*)\s*=(.*)$/.exec(line);
    if (!match || values.has(match[1])) throw new Error(`${label} 第 ${index + 1} 行非法或重复，拒绝修改`);
    const key = match[1];
    let value = match[2].trim();
    if (value.startsWith('"') || value.startsWith("'")) {
      if (value.length < 2 || value.at(-1) !== value[0]) throw new Error(`${label} 第 ${index + 1} 行引号不成对`);
      value = value.slice(1, -1);
    }
    values.set(key, value);
    return { line, key };
  });
  return { rows, values };
}
const current = parseConfiguration(source, '源运行配置');
const target = parseConfiguration(template, '目标模板');
const expectedTag = environment === 'production' ? 'd4a24749d077' : '02cb751c0b83';
const origin = environment === 'production' ? 'https://yangtzeu.work' : 'https://prev.yangtzeu.work';
const port = environment === 'production' ? 18100 : 18200;
const identity = new Map([
  ['GEEK_DEPLOYMENT_ENVIRONMENT', environment], ['GEEK_ENVIRONMENT_ORIGIN', origin], ['PUBLIC_ORIGIN', origin],
  ['COMPOSE_PROJECT_NAME', `yzgc-${environment}`], ['STACK_ROOT', `/opt/yzgc/${environment}`], ['TRUST_PROXY', '2'],
]);
if (current.values.get('IMAGE_TAG') !== expectedTag || [...identity].some(([key, value]) => current.values.get(key) !== value)) {
  throw new Error('源运行配置与本次环境/已发布版本不一致，拒绝修改');
}
if ([...identity, ['WEB_BIND', `10.66.0.2:${port}`], ['SERVER_BIND', `127.0.0.1:${port + 1}`]].some(([key, value]) => target.values.get(key) !== value)) {
  throw new Error('目标模板与本次环境/Arch 两层代理不一致，拒绝修改');
}
if (!current.values.get('ENCRYPTION_KEY')) throw new Error('缺少原 ENCRYPTION_KEY，拒绝生成无法解密数据的配置');
const changes = new Map([
  ['DEPLOY_HOST', '10.66.0.2'],
  ['DEPLOY_PORT', '22'],
  ['DEPLOY_USER', 'root'],
  ['DEPLOY_PROXY_JUMP', 'root@156.238.244.78:22'],
  ['WEB_BIND', `10.66.0.2:${port}`],
  ['SERVER_BIND', `127.0.0.1:${port + 1}`],
  ['GITLAB_SYNC', 'off'],
  ['MAIL_RECIPIENTS', 'allowlist'],
  ['MAIL_ALLOWLIST', ''],
]);
const seen = new Set(current.values.keys());
const rows = current.rows.map(({ line, key }) => changes.has(key) ? `${key}=${changes.get(key)}` : line);
for (const { line, key } of target.rows) {
  if (key && !seen.has(key)) {
    rows.push(changes.has(key) ? `${key}=${changes.get(key)}` : line);
    seen.add(key);
  }
}
for (const [key, value] of changes) if (!seen.has(key)) rows.push(`${key}=${value}`);
const temporary = `${file}.prepare-${process.pid}`;
writeFileSync(temporary, `${rows.filter((line, index) => line || index < rows.length - 1).join('\n')}\n`, { flag: 'wx', mode: 0o600 });
renameSync(temporary, file);
console.log(JSON.stringify({ environment, scope: 'env', replica_verified: false, image_tag: expectedTag, web_bind: `10.66.0.2:${port}`, server_bind: `127.0.0.1:${port + 1}`, gitlab_sync: 'off', mail_recipients: 'allowlist', mail_allowlist_empty: true }));
console.error('仅 env 准备完成；启动副本前必须运行 verify-arch-replica.mjs 核验复制库持久配置，并满足出站隔离门禁。');
