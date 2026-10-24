// The forum's package.json and pnpm-lock.yaml stay upstream's except for the
// dependencies the owner approved by name and exact version, listed in
// app/forum/ADOPTION.json `approvedDependencies` together with the sha256 of
// the lockfile that was reviewed with them. Used by check-forum-adoption.mjs.
import { createHash } from 'node:crypto';

const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const EXACT = /^\d+\.\d+\.\d+$/;
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Problems with the forum manifest and lockfile against upstream (`upstream` is
 * UPSTREAM.json `original_files`); an empty list means they pass.
 */
export function dependencyProblems({ manifest, lockfile, upstream, approved }) {
  const manifestChanged = sha256(manifest) !== upstream['package.json'];
  const lockfileChanged = sha256(lockfile) !== upstream['pnpm-lock.yaml'];
  if (!approved) return manifestChanged || lockfileChanged ? ['package.json or pnpm-lock.yaml differs from upstream and ADOPTION.json approves no dependencies'] : [];

  const problems = [];
  const { approval, dependencies, lockfileSha256 } = approved;
  if (typeof approval !== 'string' || !approval.trim()) problems.push('approvedDependencies.approval must say who approved the dependencies and when');
  const entries = Object.entries(dependencies ?? {});
  if (!entries.length) problems.push('approvedDependencies.dependencies is empty');

  let parsed;
  try {
    parsed = JSON.parse(manifest);
  } catch {
    return [...problems, 'package.json is not valid JSON'];
  }
  const rest = { ...parsed.dependencies };
  for (const [name, version] of entries) {
    if (typeof version !== 'string' || !EXACT.test(version)) problems.push(`${name}: the approved version must be exact (x.y.z), not ${JSON.stringify(version)}`);
    if (rest[name] !== version) problems.push(`${name}: package.json has ${JSON.stringify(rest[name] ?? null)}, approved ${JSON.stringify(version)}`);
    delete rest[name];
    const importer = new RegExp(`\\n {6}'?${escape(name)}'?:\\n {8}specifier: ${escape(String(version))}\\n {8}version: ${escape(String(version))}[(\\n]`);
    if (!importer.test(lockfile)) problems.push(`${name}: pnpm-lock.yaml does not resolve ${version} for the forum`);
  }
  // Without the approved entries the manifest must be upstream's byte for byte
  // (upstream writes it as JSON.stringify(…, null, 2) plus a newline).
  if (sha256(`${JSON.stringify({ ...parsed, dependencies: rest }, null, 2)}\n`) !== upstream['package.json'])
    problems.push('package.json differs from upstream beyond the approved dependencies');
  if (sha256(lockfile) !== lockfileSha256) problems.push('pnpm-lock.yaml is not the reviewed lockfile (approvedDependencies.lockfileSha256)');
  return problems;
}
