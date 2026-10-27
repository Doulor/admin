import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { installSh } from '../../scripts/cli-dist.mjs'

const roots: string[] = []
function temporary() {
  const root = mkdtempSync(join(tmpdir(), 'geek-distribution-'))
  roots.push(root)
  return root
}
function put(path: string, contents: string, executable = false) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, contents, { mode: executable ? 0o755 : 0o644 })
}
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('monorepo CLI distribution', () => {
  it('packages the cargo-selected target directory instead of assuming app/cli/target', () => {
    const root = temporary()
    execFileSync('git', ['init', '-q', root])
    mkdirSync(join(root, 'scripts'))
    copyFileSync(resolve('scripts/cli-dist.mjs'), join(root, 'scripts/cli-dist.mjs'))
    put(join(root, 'app/cli/Cargo.toml'), '[package]\nname = "geek-cli"\nversion = "0.1.0"\n')
    put(join(root, '.tools/zig/zig-macos-aarch64-0.13.0/zig'), '#!/bin/sh\nexit 0\n', true)
    put(join(root, '.tools/cargo/bin/cargo-zigbuild'), '#!/bin/sh\nexit 0\n', true)
    const target = join(root, 'isolated-target')
    put(join(root, 'bin/cargo'), `#!/bin/sh
set -eu
if [ "$1" = metadata ]; then
  printf '{"target_directory":"%s"}\\n' "$CARGO_TARGET_DIR"
else
  printf '%s\\n' "$*" >> "$CARGO_TARGET_DIR/commands"
  mkdir -p "$CARGO_TARGET_DIR/aarch64-apple-darwin/release"
  printf 'synthetic build output\\n' > "$CARGO_TARGET_DIR/aarch64-apple-darwin/release/geek"
fi
`, true)
    mkdirSync(target)
    const output = spawnSync(process.execPath, ['scripts/cli-dist.mjs', '--target', 'aarch64-apple-darwin'], {
      cwd: root, encoding: 'utf8',
      env: { PATH: `${join(root, 'bin')}:/usr/bin:/bin`, CARGO_TARGET_DIR: target },
    })
    expect(output.status, output.stdout + output.stderr).toBe(0)
    const latest = JSON.parse(readFileSync(join(root, 'dist/cli/latest.json'), 'utf8'))
    const expectedSha = createHash('sha256').update('synthetic build output\n').digest('hex')
    const expectedFile = `geek-aarch64-apple-darwin-${expectedSha}`
    expect(latest.assets['aarch64-apple-darwin']).toMatchObject({ file: expectedFile, sha256: expectedSha })
    const binary = readFileSync(join(root, 'dist/cli/0.1.0', expectedFile))
    expect(binary.toString()).toBe('synthetic build output\n')
    expect(readFileSync(join(target, 'commands'), 'utf8')).toContain('--locked')
    expect(readFileSync(join(target, 'commands'), 'utf8')).toContain('--jobs 2')
  })

  it('verifies checksums and installs the real CLI into an isolated HOME', () => {
    const root = temporary()
    const target = process.env.CARGO_TARGET_DIR ?? resolve('.tools/acceptance-cargo-target')
    if (!process.env.GEEK_TEST_BINARY) {
      execFileSync('cargo', ['build', '--manifest-path', resolve('app/cli/Cargo.toml'), '--locked', '--offline', '--jobs', '2'], {
        env: { ...process.env, CARGO_TARGET_DIR: target, CARGO_PROFILE_DEV_DEBUG: '0', CARGO_INCREMENTAL: '0' },
      })
    }
    const binary = process.env.GEEK_TEST_BINARY ?? join(target, 'debug', process.platform === 'win32' ? 'geek.exe' : 'geek')
    const bytes = readFileSync(binary)
    const sha = createHash('sha256').update(bytes).digest('hex')
    put(join(root, 'install.sh'), installSh())
    copyFileSync(binary, join(root, 'download'))
    put(join(root, 'bin/curl'), `#!/bin/sh
set -eu
for arg do
  case "$arg" in
    */cli/latest.json) printf '{"version":"0.1.0"}\\n'; exit 0 ;;
    *.sha256) asset="\${arg##*/}"; printf '%s  %s\\n' "\${FIXTURE_SHA}" "\${asset%.sha256}"; exit 0 ;;
  esac
done
while [ "$1" != "-o" ]; do shift; done
cp "$FIXTURE_ROOT/download" "$2"
`, true)
    const env = { HOME: root, PATH: `${join(root, 'bin')}:/usr/bin:/bin`, GEEK_ORIGIN: 'https://fixture.invalid', FIXTURE_ROOT: root, FIXTURE_SHA: sha }
    const installed = spawnSync('/bin/sh', [join(root, 'install.sh')], { env, encoding: 'utf8' })
    expect(installed.status, installed.stdout + installed.stderr).toBe(0)
    expect(execFileSync(join(root, '.local/bin/geek'), ['--version'], { encoding: 'utf8' })).toBe('geek 0.1.0\n')
    expect(createHash('sha256').update(readFileSync(join(root, '.local/bin/geek'))).digest('hex')).toBe(sha)
    const mismatch = spawnSync('/bin/sh', [join(root, 'install.sh')], { env: { ...env, FIXTURE_SHA: '0'.repeat(64) }, encoding: 'utf8' })
    expect(mismatch.status).toBe(1)
    expect(mismatch.stderr).toContain('sha256 不匹配')
    expect(createHash('sha256').update(readFileSync(join(root, '.local/bin/geek'))).digest('hex')).toBe(sha)
    put(join(root, 'download'), '#!/bin/sh\nexit 7\n')
    const brokenSha = createHash('sha256').update(readFileSync(join(root, 'download'))).digest('hex')
    const broken = spawnSync('/bin/sh', [join(root, 'install.sh')], {
      env: { ...env, FIXTURE_SHA: brokenSha, GEEK_INSTALL_DIR: join(root, 'broken') }, encoding: 'utf8',
    })
    expect(broken.status, broken.stdout + broken.stderr).toBe(1)
    expect(broken.stderr).toContain('无法运行')
  }, 180_000)
})
