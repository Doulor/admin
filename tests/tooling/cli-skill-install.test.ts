import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const manifest = `${root}/app/cli/Cargo.toml`

describe('geek skill installer integration', () => {
  it('runs the real isolated Rust harness for harness paths and preservation', () => {
    const output = execFileSync('cargo', ['test', '--manifest-path', manifest, '--locked', '--offline', '--test', 'skill_install'], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        CARGO_TARGET_DIR: process.env.CARGO_TARGET_DIR ?? `${root}/.tools/acceptance-cargo-target`,
        CARGO_BUILD_JOBS: '2',
        CARGO_PROFILE_DEV_DEBUG: '0',
        CARGO_INCREMENTAL: '0',
        CARGO_NET_OFFLINE: 'true',
      },
    })
    expect(output).toContain('9 passed')
  }, 180_000)
})
