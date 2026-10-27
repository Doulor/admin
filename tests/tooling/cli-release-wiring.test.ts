import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyCliDist } from '../../scripts/check-cli-dist.mjs';
import { CONTAINER_BUILDER_IMAGE, installPs1, installSh, resolveManifestAsset } from '../../scripts/cli-dist.mjs';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const pwshPath = spawnSync('/bin/sh', ['-c', 'command -v pwsh'], { encoding: 'utf8' }).stdout.trim();
const powershellIt = pwshPath ? it : it.skip;

function read(path: string) {
  return readFileSync(`${repoRoot}/${path}`, 'utf8');
}

function put(path: string, contents: string, executable = false) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, { mode: executable ? 0o755 : 0o644 });
}

function syntheticCliDistRoot() {
  const root = mkdtempSync(join(tmpdir(), 'cli-dist-addressed-'));
  spawnSync('git', ['init', '-q', root], { encoding: 'utf8' });
  mkdirSync(join(root, 'scripts'), { recursive: true });
  copyFileSync(join(repoRoot, 'scripts/cli-dist.mjs'), join(root, 'scripts/cli-dist.mjs'));
  put(join(root, 'app/cli/Cargo.toml'), '[package]\nname = "geek-cli"\nversion = "0.1.0"\n');
  put(join(root, '.tools/zig/zig-macos-aarch64-0.13.0/zig'), '#!/bin/sh\nexit 0\n', true);
  put(join(root, '.tools/cargo/bin/cargo-zigbuild'), '#!/bin/sh\nexit 0\n', true);
  put(join(root, 'bin/cargo'), `#!/bin/sh
set -eu
if [ "$1" = metadata ]; then
  printf '{"target_directory":"%s"}\\n' "$CARGO_TARGET_DIR"
  exit 0
fi
mkdir -p "$CARGO_TARGET_DIR/aarch64-apple-darwin/release"
printf '%s' "$FIXTURE_BYTES" > "$CARGO_TARGET_DIR/aarch64-apple-darwin/release/geek"
`, true);
  mkdirSync(join(root, 'target'));
  return root;
}

function runSyntheticCliDist(root: string, bytes: string) {
  return spawnSync(process.execPath, ['scripts/cli-dist.mjs', '--target', 'aarch64-apple-darwin'], {
    cwd: root,
    encoding: 'utf8',
    env: {
      PATH: `${join(root, 'bin')}:/usr/bin:/bin`,
      CARGO_TARGET_DIR: join(root, 'target'),
      FIXTURE_BYTES: bytes,
    },
  });
}

function completeCliDistFixture(contentAddressed: boolean) {
  const root = mkdtempSync(join(tmpdir(), 'cli-dist-'));
  const versionDir = join(root, 'dist/cli/0.1.0');
  mkdirSync(join(root, 'app/cli'), { recursive: true });
  mkdirSync(versionDir, { recursive: true });
  writeFileSync(join(root, 'app/cli/Cargo.toml'), '[package]\nversion = "0.1.0"\n');
  const assets: Record<string, { file: string; sha256: string }> = {};
  for (const target of [
    'aarch64-apple-darwin',
    'x86_64-apple-darwin',
    'x86_64-unknown-linux-musl',
    'aarch64-unknown-linux-musl',
    'x86_64-pc-windows-gnu',
  ]) {
    const suffix = target.endsWith('windows-gnu') ? '.exe' : '';
    const bytes = Buffer.from(`fixture:${target}`);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const file = contentAddressed ? `geek-${target}-${sha256}${suffix}` : `geek-${target}${suffix}`;
    writeFileSync(join(versionDir, file), bytes);
    chmodSync(join(versionDir, file), 0o755);
    writeFileSync(join(versionDir, `${file}.sha256`), `${sha256}  ${file}\n`);
    assets[target] = { file, sha256 };
  }
  writeFileSync(join(root, 'dist/cli/latest.json'), `${JSON.stringify({ version: '0.1.0', assets })}\n`);
  writeFileSync(join(root, 'dist/cli/install.sh'), '#!/bin/sh\n');
  writeFileSync(join(root, 'dist/cli/install.ps1'), 'Write-Host geek\n');
  return root;
}

function shellInstallerFixture(
  manifest: object,
  binary = '#!/bin/sh\necho "geek 0.1.0"\n',
  servedAsset?: string,
) {
  const root = mkdtempSync(join(tmpdir(), 'cli-installer-'));
  const target = 'x86_64-apple-darwin';
  const bytes = Buffer.from(binary);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const asset = servedAsset ?? `geek-${target}-${sha256}`;
  put(join(root, 'install.sh'), installSh(), true);
  put(join(root, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  put(join(root, 'download'), binary, true);
  put(join(root, 'checksum'), `${sha256}  ${asset}\n`);
  put(join(root, 'bin/uname'), '#!/bin/sh\n[ "$1" = "-s" ] && echo Darwin || echo x86_64\n', true);
  put(join(root, 'bin/curl'), `#!/bin/sh
set -eu
url=""
out=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    -o) out="$2"; shift 2; continue ;;
    http://*|https://*) url="$1" ;;
  esac
  shift
done
printf '%s\\n' "$url" >> "$FIXTURE_ROOT/urls"
case "$url" in
  */cli/latest.json) cat "$FIXTURE_ROOT/manifest.json" ;;
  */${asset}.sha256) cat "$FIXTURE_ROOT/checksum" ;;
  */${asset}) [ -n "$out" ] && cp "$FIXTURE_ROOT/download" "$out" ;;
  *) echo "unexpected URL: $url" >&2; exit 22 ;;
esac
`, true);
  return { root, target, sha256, asset };
}

describe('CLI release material wiring', () => {
  it.each([
    '.github/workflows/ci.yml',
    '.github/workflows/deploy-preview.yml',
    '.github/workflows/deploy-production.yml',
  ])('%s builds and validates the five-target dist before feeding it to the web image', path => {
    const workflow = read(path);

    expect(workflow).toContain('node scripts/cli-dist.mjs --container');
    expect(workflow).toContain('node scripts/check-cli-dist.mjs');
    expect(workflow.match(/--build-context cli=dist\/cli/g)).toHaveLength(1);
  });

  it('the web Dockerfile consumes only the named CLI build context', () => {
    const dockerfile = read('app/web/Dockerfile');

    expect(dockerfile).toContain('FROM scratch AS cli');
    expect(dockerfile).toContain('COPY --from=cli / /usr/share/nginx/html/cli/');
    expect(read('.dockerignore')).toContain('**/dist');
  });

  it('preview and production use the same CLI build-and-verify step', () => {
    const step = (workflow: string) => workflow.match(
      /      - name: 构建并核对 CLI 五目标分发物料\n[\s\S]*?(?=\n      - name:)/,
    )?.[0];
    const preview = step(read('.github/workflows/deploy-preview.yml'));
    const production = step(read('.github/workflows/deploy-production.yml'));

    expect(preview).toBeTruthy();
    expect(production).toBe(preview);
  });

  it('pins the Linux cross-builder by digest instead of a mutable tag', () => {
    expect(CONTAINER_BUILDER_IMAGE).toMatch(/^ghcr\.io\/rust-cross\/cargo-zigbuild@sha256:[0-9a-f]{64}$/);
  });

  it('uses stable content-addressed URLs and preserves older bytes for the same CLI version', () => {
    const root = syntheticCliDistRoot();
    const first = runSyntheticCliDist(root, 'first-build');
    expect(first.status, first.stdout + first.stderr).toBe(0);
    const firstManifest = JSON.parse(readFileSync(join(root, 'dist/cli/latest.json'), 'utf8'));
    const firstEntry = firstManifest.assets['aarch64-apple-darwin'];
    const firstPath = join(root, 'dist/cli/0.1.0', firstEntry.file);

    const second = runSyntheticCliDist(root, 'second-build');
    expect(second.status, second.stdout + second.stderr).toBe(0);
    const secondManifest = JSON.parse(readFileSync(join(root, 'dist/cli/latest.json'), 'utf8'));
    const secondEntry = secondManifest.assets['aarch64-apple-darwin'];
    const secondPath = join(root, 'dist/cli/0.1.0', secondEntry.file);

    expect(firstEntry.file).toMatch(/^geek-aarch64-apple-darwin-[0-9a-f]{64}$/);
    expect(secondEntry.file).toMatch(/^geek-aarch64-apple-darwin-[0-9a-f]{64}$/);
    expect(secondEntry.file).not.toBe(firstEntry.file);
    expect(readFileSync(firstPath, 'utf8')).toBe('first-build');
    expect(readFileSync(secondPath, 'utf8')).toBe('second-build');

    const repeated = runSyntheticCliDist(root, 'second-build');
    expect(repeated.status, repeated.stdout + repeated.stderr).toBe(0);
    const repeatedManifest = JSON.parse(readFileSync(join(root, 'dist/cli/latest.json'), 'utf8'));
    expect(repeatedManifest.assets['aarch64-apple-darwin'].file).toBe(secondEntry.file);
  });

  it('refuses to overwrite a pre-existing content-addressed path with different bytes', () => {
    const root = syntheticCliDistRoot();
    const bytes = 'expected-build';
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const asset = `geek-aarch64-apple-darwin-${sha256}`;
    put(join(root, 'dist/cli/0.1.0', asset), 'tampered-existing-bytes');

    const built = runSyntheticCliDist(root, bytes);

    expect(built.status).toBe(1);
    expect(built.stderr).toContain('拒绝覆盖已存在但内容不同的内容寻址文件');
    expect(readFileSync(join(root, 'dist/cli/0.1.0', asset), 'utf8')).toBe('tampered-existing-bytes');
  });

  it('rejects an incomplete five-target manifest', () => {
    const root = mkdtempSync(join(tmpdir(), 'cli-dist-'));
    mkdirSync(join(root, 'app/cli'), { recursive: true });
    mkdirSync(join(root, 'dist/cli/0.1.0'), { recursive: true });
    writeFileSync(join(root, 'app/cli/Cargo.toml'), '[package]\nversion = "0.1.0"\n');
    writeFileSync(join(root, 'dist/cli/latest.json'), '{"version":"0.1.0","assets":{}}\n');

    expect(() => verifyCliDist({ root })).toThrow(/必须且只能包含 5 个目标/);
  });

  it('accepts five content-addressed non-empty assets with matching checksums and installers', () => {
    const root = completeCliDistFixture(true);
    expect(verifyCliDist({ root })).toMatchObject({ version: '0.1.0', targets: 5 });
  });

  it('rejects mutable legacy filenames from a newly built distribution', () => {
    const root = completeCliDistFixture(false);
    expect(() => verifyCliDist({ root })).toThrow(/内容寻址/);
  });

  it('the shell installer follows the target-specific content-addressed manifest entry', () => {
    const target = 'x86_64-apple-darwin';
    const binary = '#!/bin/sh\necho "geek 0.1.0"\n';
    const sha256 = createHash('sha256').update(binary).digest('hex');
    const asset = `geek-${target}-${sha256}`;
    const { root } = shellInstallerFixture({
      version: '0.1.0',
      assets: { [target]: { file: asset, sha256 } },
    }, binary);

    const installed = spawnSync('/bin/sh', [join(root, 'install.sh')], {
      encoding: 'utf8',
      env: {
        HOME: root,
        PATH: `${join(root, 'bin')}:/usr/bin:/bin`,
        GEEK_ORIGIN: 'https://fixture.invalid',
        FIXTURE_ROOT: root,
      },
    });

    expect(installed.status, installed.stdout + installed.stderr).toBe(0);
    expect(readFileSync(join(root, 'urls'), 'utf8')).toContain(`/cli/0.1.0/${asset}\n`);
    expect(readFileSync(join(root, '.local/bin/geek'), 'utf8')).toBe(binary);
  });

  it('keeps the shell installer compatible with a version-only legacy manifest', () => {
    const legacyAsset = 'geek-x86_64-apple-darwin';
    const { root } = shellInstallerFixture({ version: '0.1.0' }, undefined, legacyAsset);
    const installed = spawnSync('/bin/sh', [join(root, 'install.sh')], {
      encoding: 'utf8',
      env: {
        HOME: root,
        PATH: `${join(root, 'bin')}:/usr/bin:/bin`,
        GEEK_ORIGIN: 'https://fixture.invalid',
        FIXTURE_ROOT: root,
      },
    });

    expect(installed.status, installed.stdout + installed.stderr).toBe(0);
    expect(readFileSync(join(root, 'urls'), 'utf8')).toContain(`/cli/0.1.0/${legacyAsset}\n`);
  });

  it('keeps the shell installer compatible with the previous manifest asset entry', () => {
    const binary = '#!/bin/sh\necho "geek 0.1.0"\n';
    const sha256 = createHash('sha256').update(binary).digest('hex');
    const legacyAsset = 'geek-x86_64-apple-darwin';
    const { root } = shellInstallerFixture({
      version: '0.1.0',
      assets: { 'x86_64-apple-darwin': { file: legacyAsset, sha256 } },
    }, binary, legacyAsset);
    const installed = spawnSync('/bin/sh', [join(root, 'install.sh')], {
      encoding: 'utf8',
      env: {
        HOME: root,
        PATH: `${join(root, 'bin')}:/usr/bin:/bin`,
        GEEK_ORIGIN: 'https://fixture.invalid',
        FIXTURE_ROOT: root,
      },
    });

    expect(installed.status, installed.stdout + installed.stderr).toBe(0);
    expect(readFileSync(join(root, 'urls'), 'utf8')).toContain(`/cli/0.1.0/${legacyAsset}\n`);
  });

  it.each([
    ['path traversal', (sha: string) => ({ version: '0.1.0', assets: { 'x86_64-apple-darwin': { file: '../geek', sha256: sha } } })],
    ['backslash traversal', (sha: string) => ({ version: '0.1.0', assets: { 'x86_64-apple-darwin': { file: '..\\geek', sha256: sha } } })],
    ['absolute URL', (sha: string) => ({ version: '0.1.0', assets: { 'x86_64-apple-darwin': { file: 'https://evil.invalid/geek', sha256: sha } } })],
    ['wrong target', (sha: string) => ({ version: '0.1.0', assets: { 'x86_64-apple-darwin': { file: `geek-aarch64-apple-darwin-${sha}`, sha256: sha } } })],
    ['filename digest mismatch', (sha: string) => ({ version: '0.1.0', assets: { 'x86_64-apple-darwin': { file: `geek-x86_64-apple-darwin-${'0'.repeat(64)}`, sha256: sha } } })],
    ['missing selected target', (sha: string) => ({ version: '0.1.0', assets: { 'aarch64-apple-darwin': { file: `geek-aarch64-apple-darwin-${sha}`, sha256: sha } } })],
    ['unsafe version path', (_sha: string) => ({ version: '../0.1.0' })],
  ])('the shell installer rejects malicious manifest input: %s', (_name, manifest) => {
    const binary = '#!/bin/sh\necho "geek 0.1.0"\n';
    const sha256 = createHash('sha256').update(binary).digest('hex');
    const { root } = shellInstallerFixture(manifest(sha256), binary);
    const installed = spawnSync('/bin/sh', [join(root, 'install.sh')], {
      encoding: 'utf8',
      env: {
        HOME: root,
        PATH: `${join(root, 'bin')}:/usr/bin:/bin`,
        GEEK_ORIGIN: 'https://fixture.invalid',
        FIXTURE_ROOT: root,
      },
    });

    expect(installed.status).toBe(1);
    expect(readFileSync(join(root, 'urls'), 'utf8').trim().split('\n')).toEqual(['https://fixture.invalid/cli/latest.json']);
  });

  it('the shell installer preserves an installed CLI on checksum or executable failure', () => {
    const binary = '#!/bin/sh\necho "geek 0.1.0"\n';
    const legacyAsset = 'geek-x86_64-apple-darwin';
    const first = shellInstallerFixture({ version: '0.1.0' }, binary, legacyAsset);
    put(join(first.root, '.local/bin/geek'), 'existing-cli\n', true);
    put(join(first.root, 'checksum'), `${'0'.repeat(64)}  ${legacyAsset}\n`);
    const badChecksum = spawnSync('/bin/sh', [join(first.root, 'install.sh')], {
      encoding: 'utf8',
      env: { HOME: first.root, PATH: `${join(first.root, 'bin')}:/usr/bin:/bin`, GEEK_ORIGIN: 'https://fixture.invalid', FIXTURE_ROOT: first.root },
    });
    expect(badChecksum.status).toBe(1);
    expect(badChecksum.stderr).toContain('sha256 不匹配');
    expect(readFileSync(join(first.root, '.local/bin/geek'), 'utf8')).toBe('existing-cli\n');

    const brokenBinary = '#!/bin/sh\nexit 7\n';
    const brokenSha = createHash('sha256').update(brokenBinary).digest('hex');
    const brokenAsset = `geek-x86_64-apple-darwin-${brokenSha}`;
    const second = shellInstallerFixture({
      version: '0.1.0', assets: { 'x86_64-apple-darwin': { file: brokenAsset, sha256: brokenSha } },
    }, brokenBinary);
    put(join(second.root, '.local/bin/geek'), 'existing-cli\n', true);
    const notExecutable = spawnSync('/bin/sh', [join(second.root, 'install.sh')], {
      encoding: 'utf8',
      env: { HOME: second.root, PATH: `${join(second.root, 'bin')}:/usr/bin:/bin`, GEEK_ORIGIN: 'https://fixture.invalid', FIXTURE_ROOT: second.root },
    });
    expect(notExecutable.status).toBe(1);
    expect(notExecutable.stderr).toContain('无法运行');
    expect(readFileSync(join(second.root, '.local/bin/geek'), 'utf8')).toBe('existing-cli\n');
  });

  it('the shell installer rejects a manifest and sidecar checksum disagreement', () => {
    const binary = '#!/bin/sh\necho "geek 0.1.0"\n';
    const sha256 = createHash('sha256').update(binary).digest('hex');
    const asset = `geek-x86_64-apple-darwin-${sha256}`;
    const { root } = shellInstallerFixture({
      version: '0.1.0', assets: { 'x86_64-apple-darwin': { file: asset, sha256 } },
    }, binary);
    put(join(root, 'checksum'), `${'0'.repeat(64)}  ${asset}\n`);

    const installed = spawnSync('/bin/sh', [join(root, 'install.sh')], {
      encoding: 'utf8',
      env: { HOME: root, PATH: `${join(root, 'bin')}:/usr/bin:/bin`, GEEK_ORIGIN: 'https://fixture.invalid', FIXTURE_ROOT: root },
    });

    expect(installed.status).toBe(1);
    expect(installed.stderr).toContain('latest.json 与 sha256 文件不一致');
  });

  it('the shell installer rejects sidecars that name another file or add extra lines', () => {
    const binary = '#!/bin/sh\necho "geek 0.1.0"\n';
    const sha256 = createHash('sha256').update(binary).digest('hex');
    const asset = `geek-x86_64-apple-darwin-${sha256}`;
    const manifest = { version: '0.1.0', assets: { 'x86_64-apple-darwin': { file: asset, sha256 } } };
    for (const checksum of [
      `${sha256}  another-file\n`,
      `${sha256}  ${asset}\n${sha256}  another-file\n`,
    ]) {
      const { root } = shellInstallerFixture(manifest, binary);
      put(join(root, 'checksum'), checksum);
      const installed = spawnSync('/bin/sh', [join(root, 'install.sh')], {
        encoding: 'utf8',
        env: { HOME: root, PATH: `${join(root, 'bin')}:/usr/bin:/bin`, GEEK_ORIGIN: 'https://fixture.invalid', FIXTURE_ROOT: root },
      });
      expect(installed.status).toBe(1);
    }
  });

  it('resolves new and legacy manifests through the shared installer policy', () => {
    const target = 'x86_64-pc-windows-gnu';
    const sha256 = 'a'.repeat(64);
    expect(resolveManifestAsset({
      version: '0.1.0',
      assets: { [target]: { file: `geek-${target}-${sha256}.exe`, sha256 } },
    }, target)).toEqual({
      version: '0.1.0',
      file: `geek-${target}-${sha256}.exe`,
      sha256,
      contentAddressed: true,
    });
    expect(resolveManifestAsset({ version: '0.1.0' }, target)).toEqual({
      version: '0.1.0',
      file: `geek-${target}.exe`,
      sha256: null,
      contentAddressed: false,
    });
  });

  it.each([
    ['unsafe version', { version: '../0.1.0' }],
    ['missing target', { version: '0.1.0', assets: {} }],
    ['path traversal', { version: '0.1.0', assets: { 'x86_64-pc-windows-gnu': { file: '../geek.exe', sha256: 'a'.repeat(64) } } }],
    ['backslash traversal', { version: '0.1.0', assets: { 'x86_64-pc-windows-gnu': { file: '..\\geek.exe', sha256: 'a'.repeat(64) } } }],
    ['absolute URL', { version: '0.1.0', assets: { 'x86_64-pc-windows-gnu': { file: 'https://evil.invalid/geek.exe', sha256: 'a'.repeat(64) } } }],
    ['wrong target', { version: '0.1.0', assets: { 'x86_64-pc-windows-gnu': { file: `geek-aarch64-apple-darwin-${'a'.repeat(64)}`, sha256: 'a'.repeat(64) } } }],
    ['digest mismatch', { version: '0.1.0', assets: { 'x86_64-pc-windows-gnu': { file: `geek-x86_64-pc-windows-gnu-${'b'.repeat(64)}.exe`, sha256: 'a'.repeat(64) } } }],
  ])('rejects unsafe manifest resolution for both generated installers: %s', (_name, manifest) => {
    expect(() => resolveManifestAsset(manifest, 'x86_64-pc-windows-gnu')).toThrow();
  });

  powershellIt('the generated install.ps1 parses and prints a pasteable PATH line (#300)', () => {
    const root = mkdtempSync(join(tmpdir(), 'cli-installer-ps1-parse-'));
    const script = join(root, 'install.ps1');
    put(script, installPs1());
    const parse = spawnSync(pwshPath, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command',
      `$errors = $null; [void][System.Management.Automation.Language.Parser]::ParseFile('${script.replaceAll("'", "''")}', [ref]$null, [ref]$errors); $errors | ForEach-Object { $_.ToString() }; exit $errors.Count`,
    ], { encoding: 'utf8' });
    expect(parse.status, parse.stdout + parse.stderr).toBe(0);
    // 提示行是要用户整行粘贴进配置文件的命令：单引号字符串里 $env:Path 是字面量，只有安装目录被替换。
    const hint = spawnSync(pwshPath, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command',
      "$InstallDir = 'C:\\Users\\x\\geek'; Write-Host ('  $env:Path = \"{0};$env:Path\"' -f $InstallDir)",
    ], { encoding: 'utf8' });
    expect(hint.stdout.trim()).toBe('$env:Path = "C:\\Users\\x\\geek;$env:Path"');
    expect(installPs1()).toContain(`Write-Host ('  $env:Path = "{0};$env:Path"' -f $InstallDir)`);
  });

  powershellIt('the PowerShell installer rejects malicious manifest paths before any asset request', () => {
    const root = mkdtempSync(join(tmpdir(), 'cli-installer-ps1-'));
    put(join(root, 'install.ps1'), installPs1());
    const manifests = [
      { version: '../0.1.0' },
      { version: '0.1.0', assets: {} },
      { version: '0.1.0', assets: { 'x86_64-pc-windows-gnu': { file: '../geek.exe', sha256: 'a'.repeat(64) } } },
      { version: '0.1.0', assets: { 'x86_64-pc-windows-gnu': { file: '..\\geek.exe', sha256: 'a'.repeat(64) } } },
      { version: '0.1.0', assets: { 'x86_64-pc-windows-gnu': { file: 'https://evil.invalid/geek.exe', sha256: 'a'.repeat(64) } } },
      { version: '0.1.0', assets: { 'x86_64-pc-windows-gnu': { file: `geek-aarch64-apple-darwin-${'a'.repeat(64)}`, sha256: 'a'.repeat(64) } } },
    ];

    for (const [index, manifest] of manifests.entries()) {
      const manifestPath = join(root, `manifest-${index}.json`);
      const wrapperPath = join(root, `wrapper-${index}.ps1`);
      put(manifestPath, JSON.stringify(manifest));
      put(wrapperPath, `
$env:GEEK_ORIGIN = 'https://fixture.invalid'
$env:GEEK_INSTALL_DIR = '${join(root, 'install').replaceAll("'", "''")}'
function Invoke-RestMethod { param([string]$Uri) Get-Content -Raw '${manifestPath.replaceAll("'", "''")}' | ConvertFrom-Json }
function Invoke-WebRequest { throw 'asset request must not happen for an invalid manifest' }
& '${join(root, 'install.ps1').replaceAll("'", "''")}'
`);
      const result = spawnSync(pwshPath, ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', wrapperPath], { encoding: 'utf8' });
      expect(result.status, result.stdout + result.stderr).not.toBe(0);
      expect(result.stdout + result.stderr).not.toContain('asset request must not happen');
    }
  });
});
