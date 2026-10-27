import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const backup = join(root, 'deploy/gitlab/backup.sh');
const restore = join(root, 'deploy/gitlab/restore-drill.sh');

describe('GitLab Garage backup wiring', () => {
  it('keeps encryption before additive upload and contains no old provider, sync, purge or remote delete path', () => {
    const text = readFileSync(backup, 'utf8');
    expect(text).not.toMatch(/QINIU_|provider=Qiniu|RCLONE_CONFIG_QN_|rclone\s+(?:sync|purge|delete|move)/i);
    expect(text).toContain('GITLAB_BACKUP_S3_ACCESS_KEY_ID');
    expect(text).toContain('GITLAB_BACKUP_S3_SECRET_ACCESS_KEY');
    expect(text).toMatch(/gpg[\s\S]+SHA256SUMS[\s\S]+put-tree/);
    expect(text).toContain('gitlab/${DAY}/${STAMP}/');
    expect(text).not.toMatch(/find[\s\S]+-delete|rm -rf "\/srv\/gitlab\/backups-enc/);
  });

  it('preserves the date selector, downloads one immutable run and verifies full SHA-256 before decrypting', () => {
    const text = readFileSync(restore, 'utf8');
    expect(text).not.toMatch(/QINIU_|provider=Qiniu|RCLONE_CONFIG_QN_/i);
    expect(text).toContain('resolve-gitlab-run');
    expect(text).toContain('--day');
    expect(text).toMatch(/get-tree[\s\S]+sha256sum -c SHA256SUMS[\s\S]+gpg/);
    expect(text).not.toMatch(/rclone\s+(?:copy|sync|purge|delete|move)/i);
  });

  it('keeps both shell entrypoints syntactically valid', () => {
    for (const script of [backup, restore]) {
      const result = spawnSync('bash', ['-n', script], { encoding: 'utf8' });
      expect(result.status, result.stderr).toBe(0);
    }
  });
});
