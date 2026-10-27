#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveManifestAsset } from './cli-dist.mjs';

export const CLI_TARGETS = [
  'aarch64-apple-darwin',
  'x86_64-apple-darwin',
  'x86_64-unknown-linux-musl',
  'aarch64-unknown-linux-musl',
  'x86_64-pc-windows-gnu',
];

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function verifyCliDist({ root = process.cwd(), dist = 'dist/cli', version } = {}) {
  const cargoToml = readFileSync(resolve(root, 'app/cli/Cargo.toml'), 'utf8');
  const packageVersion = /^version\s*=\s*"([^"]+)"/m.exec(cargoToml)?.[1];
  const expectedVersion = version ?? packageVersion;
  if (!expectedVersion) throw new Error('app/cli/Cargo.toml 里没有 version。');

  const distRoot = resolve(root, dist);
  const manifestPath = resolve(distRoot, 'latest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest.version !== expectedVersion) {
    throw new Error(`latest.json 版本不符：期望 ${expectedVersion}，实际 ${manifest.version ?? '缺失'}。`);
  }

  const actualTargets = Object.keys(manifest.assets ?? {}).sort();
  const expectedTargets = [...CLI_TARGETS].sort();
  if (JSON.stringify(actualTargets) !== JSON.stringify(expectedTargets)) {
    throw new Error(`latest.json 必须且只能包含 5 个目标：${expectedTargets.join('、')}；实际：${actualTargets.join('、') || '空'}。`);
  }

  let totalBytes = 0;
  for (const target of CLI_TARGETS) {
    const resolved = resolveManifestAsset(manifest, target);
    if (!resolved.contentAddressed) throw new Error(`${target} 必须使用内容寻址文件名。`);
    const entry = manifest.assets[target];
    const file = resolved.file;
    const assetPath = resolve(distRoot, expectedVersion, file);
    const checksumPath = `${assetPath}.sha256`;
    if (!existsSync(assetPath) || statSync(assetPath).size === 0) throw new Error(`${file} 缺失或为空。`);
    if (!existsSync(checksumPath) || statSync(checksumPath).size === 0) throw new Error(`${file}.sha256 缺失或为空。`);
    const actualSha = sha256(assetPath);
    if (entry.sha256 !== actualSha) throw new Error(`${file} 的 latest.json sha256 不符。`);
    const checksum = readFileSync(checksumPath, 'utf8');
    if (checksum !== `${actualSha}  ${file}\n`) throw new Error(`${file}.sha256 内容不符。`);
    totalBytes += statSync(assetPath).size;
  }

  for (const script of ['install.sh', 'install.ps1']) {
    const path = resolve(distRoot, script);
    if (!existsSync(path) || statSync(path).size === 0) throw new Error(`${script} 缺失或为空。`);
  }

  return { version: expectedVersion, targets: CLI_TARGETS.length, totalBytes };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const result = verifyCliDist();
    console.log(`CLI 分发物料通过：v${result.version}，${result.targets} 个目标，共 ${result.totalBytes} 字节。`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
