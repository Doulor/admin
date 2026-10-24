#!/usr/bin/env node
// Provenance guard, not a security audit or a replacement for upstream tests.
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dependencyProblems } from './forum-dependencies.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const base = resolve(root, 'app/forum');
const source = JSON.parse(readFileSync(resolve(base, 'UPSTREAM.json'), 'utf8'));
const adoption = JSON.parse(readFileSync(resolve(base, 'ADOPTION.json'), 'utf8'));
const permitted = new Set(Object.keys(adoption.modifiedUpstreamFiles));
const changes = [];
// package.json and pnpm-lock.yaml are checked below against approvedDependencies, never through modifiedUpstreamFiles.
const manifests = new Set(['package.json', 'pnpm-lock.yaml']);
for (const [name, expected] of Object.entries(source.original_files)) {
  const file = resolve(base, name);
  if (isAbsolute(name) || relative(base, file).startsWith('..')) throw new Error('Invalid upstream provenance path');
  if (!existsSync(file)) throw new Error(`Missing upstream source: ${name}`);
  const actual = createHash('sha256').update(readFileSync(file)).digest('hex');
  if (actual !== expected && !manifests.has(name)) {
    changes.push(name);
    if (!permitted.has(name)) throw new Error(`Undocumented upstream adaptation: ${name}`);
  }
}
if (permitted.has('LICENSE') || permitted.has('pnpm-lock.yaml') || permitted.has('package.json')) throw new Error('License/lockfile/manifest changes require a separately reviewed upstream upgrade');
const dependencies = dependencyProblems({
  manifest: readFileSync(resolve(base, 'package.json'), 'utf8'),
  lockfile: readFileSync(resolve(base, 'pnpm-lock.yaml'), 'utf8'),
  upstream: source.original_files,
  approved: adoption.approvedDependencies,
});
if (dependencies.length) throw new Error(`Unapproved forum dependency change: ${dependencies.join('; ')}`);
const approvedCount = Object.keys(adoption.approvedDependencies?.dependencies ?? {}).length;
const upgradeCount = Object.keys(adoption.approvedDependencies?.upgrades ?? {}).length;
for (const path of ['app/web/sites/forum', 'app/server/src/routes/forum', 'app/server/src/lib/forum-db.ts']) {
  if (existsSync(resolve(root, path))) throw new Error(`Retired forum implementation returned to active source: ${path}`);
}
console.log(`Forum provenance passed: ${Object.keys(source.original_files).length} upstream files, ${changes.length} documented adaptations, ${approvedCount} approved dependencies, ${upgradeCount} approved upgrades, MIT retained, source ${source.commit}.`);
