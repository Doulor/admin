#!/usr/bin/env node
// Two processes, two toolchains: never load the Node 22 SQLite addon in Vitest 26.
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, openSync, writeSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const divider = process.argv.indexOf('--');
const { values } = parseArgs({
  args: process.argv.slice(2, divider < 0 ? undefined : divider),
  options: {
    'core-root': { type: 'string', default: root },
    'evidence-dir': { type: 'string' },
  },
});
const extraArgs = divider < 0 ? [] : process.argv.slice(divider + 1);
const coreRoot = resolve(values['core-root']);
const children = [];
let interrupted = 0;
let evidence;

async function filesAt(base, path) {
  const entries = await readdir(join(base, path), { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = join(path, entry.name);
    if (entry.isDirectory()) files.push(...await filesAt(base, relative));
    else if (entry.isFile()) files.push(relative);
    else throw new Error(`Fixture source must be a regular file: ${relative}`);
  }
  return files;
}

async function sourceProof() {
  const paths = [
    ...await filesAt(root, 'app/server/src'),
    ...await filesAt(root, 'tests/server/fixtures/forum-content'),
    'tests/server/helpers.ts', 'app/server/package.json', 'package.json', 'pnpm-lock.yaml',
  ];
  if (coreRoot !== root) {
    for (const path of ['app/server/src', 'tests/server/fixtures/forum-content']) {
      if (JSON.stringify(await filesAt(root, path)) !== JSON.stringify(await filesAt(coreRoot, path)))
        throw new Error(`Prepared core checkout has different files: ${path}`);
    }
  }
  const hash = createHash('sha256');
  for (const path of paths) {
    const actual = await readFile(join(root, path));
    if (coreRoot !== root && !actual.equals(await readFile(join(coreRoot, path))))
      throw new Error(`Prepared core checkout differs from the target: ${path}`);
    hash.update(path).update('\0').update(actual).update('\0');
  }
  return { files: paths.length, sha256: hash.digest('hex') };
}

function signalChild(owned, signal) {
  if (!owned.child.pid) return;
  try { process.kill(-owned.child.pid, signal); }
  catch (error) { if (error.code !== 'ESRCH') throw error; }
}

function start(name, executable, args, options) {
  const fd = openSync(join(evidence, `${name}.log`), 'wx', 0o600);
  console.log(`[forum-editor] ${name}: ${JSON.stringify([executable, ...args])}`);
  const child = spawn(executable, args, { ...options, detached: true });
  const owned = { child, closed: false };
  owned.done = new Promise((done) => {
    child.once('error', error => {
      console.error(error.message);
      writeSync(fd, `${error.message}\n`);
    });
    child.once('close', (code, signal) => {
      owned.closed = true;
      closeSync(fd);
      done({ code: code ?? 1, signal });
    });
  });
  for (const [stream, output] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
    stream.on('data', chunk => { writeSync(fd, chunk); output.write(chunk); });
  }
  children.push(owned);
  return owned;
}

async function stop(owned) {
  signalChild(owned, 'SIGTERM');
  await Promise.race([owned.done, delay(3000, undefined, { ref: false })]);
  if (!owned.closed) {
    signalChild(owned, 'SIGKILL');
    await Promise.race([owned.done, delay(3000, undefined, { ref: false })]);
  }
  if (!owned.closed) throw new Error(`Child did not close: ${owned.child.pid}`);
}

for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143]]) {
  process.once(signal, () => {
    interrupted = code;
    for (const child of children) signalChild(child, 'SIGTERM');
  });
}

async function main() {
  if (process.versions.node.split('.')[0] !== '22')
    throw new Error('Run this root integration launcher with Node 22; FORUM_NODE must be Node >=26.');
  if (process.platform === 'win32') throw new Error('This process-group integration launcher requires macOS or Linux.');
  const proof = await sourceProof();
  const coreRequire = createRequire(join(coreRoot, 'app/server/package.json'));
  const rootRequire = createRequire(join(root, 'package.json'));
  const tsx = coreRequire.resolve('tsx');
  rootRequire.resolve('jsdom'); // Existing root devDependency, not a forum/runtime dependency.
  const forumNode = process.env.FORUM_NODE;
  const forumPnpm = process.env.FORUM_PNPM;
  if (!forumNode || !forumPnpm) throw new Error('Set FORUM_NODE and FORUM_PNPM to the prepared Node >=26 and pnpm 11.24.0.');
  const version = spawnSync(forumNode, ['-p', 'process.versions.node'], { encoding: 'utf8' });
  if (version.status !== 0 || Number(version.stdout.trim().split('.')[0]) < 26)
    throw new Error('FORUM_NODE must be Node >=26.');
  evidence = values['evidence-dir'] ? resolve(values['evidence-dir']) : await mkdtemp(join(tmpdir(), 'forum-editor-'));
  if (values['evidence-dir']) await mkdir(evidence, { mode: 0o700 });
  console.log(`[forum-editor] evidence: ${evidence}`);
  // No NODE_OPTIONS, .env, credentials, content directory or inherited server config.
  const env = {
    PATH: `${dirname(process.execPath)}:/usr/bin:/bin:/usr/sbin:/sbin`,
    HOME: process.env.HOME || root, TMPDIR: process.env.TMPDIR || tmpdir(),
    NUXT_TELEMETRY_DISABLED: '1', FORUM_NODE: forumNode, FORUM_PNPM: forumPnpm,
  };
  const result = { root, coreRoot, coreNode: process.version, forumNode: version.stdout.trim(), sourceProof: proof, exitCode: 1 };
  let fixtureOrigin;
  try {
    const fixture = start('fixture', process.execPath, [
      '--import', tsx, join(here, 'http-fixture.mts'), '--core-root', coreRoot, '--evidence-dir', evidence,
    ], { cwd: coreRoot, env, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    const ready = await Promise.race([
      new Promise(done => fixture.child.once('message', done)),
      fixture.done.then(exit => { throw new Error(`Fixture exited before ready (${exit.code}).`); }),
      delay(20000, undefined, { ref: false }).then(() => { throw new Error('Fixture startup timed out.'); }),
    ]);
    if (ready?.fixture !== 'forum-editor' || !/^http:\/\/127\.0\.0\.1:\d+$/.test(ready.origin))
      throw new Error('Invalid fixture readiness message.');
    fixtureOrigin = ready.origin;
    result.fixture = ready;
    const runner = start('tests', process.execPath, [
      join(root, 'scripts/forum.mjs'), 'test',
      '--config', 'tests/crepe-markdown.config.ts', '--run', 'tests/crepe-markdown.spec.ts', ...extraArgs,
    ], { cwd: root, env: { ...env, TUFF_FORUM_URL: fixtureOrigin }, stdio: ['ignore', 'pipe', 'pipe'] });
    const testExit = await Promise.race([
      runner.done,
      fixture.done.then(exit => { throw new Error(`Fixture exited during tests (${exit.code}).`); }),
    ]);
    result.testExit = testExit;
    result.exitCode = interrupted || testExit.code;
  }
  catch (error) {
    result.error = error.message;
    console.error(error.message);
    result.exitCode = interrupted || 1;
  }
  finally {
    try {
      for (const child of [...children].reverse()) await stop(child);
      if (fixtureOrigin) {
        let listening = false;
        try { await fetch(`${fixtureOrigin}/__a4/health`, { signal: AbortSignal.timeout(1000) }); listening = true; }
        catch { /* A closed loopback listener must refuse the connection. */ }
        if (listening) throw new Error('Fixture still answers after shutdown.');
      }
      result.cleanupConfirmed = true;
    }
    catch (error) {
      result.cleanupConfirmed = false;
      result.cleanupError = error.message;
      result.exitCode = interrupted || 1;
    }
    await writeFile(join(evidence, 'result.json'), `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
  }
  console.log(`[forum-editor] exit=${result.exitCode}; cleanup=${result.cleanupConfirmed}`);
  process.exitCode = result.exitCode;
}

main().catch(error => { console.error(error.message); process.exitCode = interrupted || 1; });
