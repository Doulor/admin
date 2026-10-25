import type Database from "better-sqlite3";
import { DEFAULT_TEMPLATES, SEED_TEMPLATES } from "../mail/template-content.js";

/**
 * #285 招聘邮件模板迁移：首次把四类招聘信现在的内容种成「默认」模板，另加一套「面试邀请 · 简短」。
 * 表 mail_templates 和它的索引、约束在 lib/db.ts 的建表语句里（和其他表一样，目录校验要从那里找建表的位置），这里只管种子。
 * 种子内容来自 lib/mail/template-content.ts 的 SEED_TEMPLATES，和代码里没有库模板时用的内置默认是同一份。
 *
 * 可以重复执行：种子用 console_seeds 的 mail_templates_v1 标记，只插一次——
 * 控制台之后改过、停用或删掉的模板，重启不会被补回来，也不会被改回去。第二次运行表和行数都不变。
 *
 * 回滚：只加了一张表和几行，回滚就是部署上一个镜像，旧代码不读这张表。
 */

export const MAIL_TEMPLATES_SEED = "mail_templates_v1";
const SEEDED_BY = "migration:2026-10-mail-templates";

export type MailTemplatesMigrationReport = {
  rows_before: number;
  rows_after: number;
  seeded_this_run: number;
};

const rowCount = (db: Database.Database): number => (db.prepare("SELECT COUNT(*) AS n FROM mail_templates").get() as { n: number }).n;

export function runMailTemplatesMigration(db: Database.Database, now: number): MailTemplatesMigrationReport {
  const before = rowCount(db);
  const insert = db.prepare(`INSERT OR IGNORE INTO mail_templates
    (id, name, kind, subject, preheader, kicker, greeting, blocks, button_label, button_path, footer, enabled, is_default, created_by, created_at, updated_by, updated_at)
    VALUES (@id, @name, @kind, @subject, @preheader, @kicker, @greeting, @blocks, @button_label, @button_path, @footer, 1, @is_default, @by, @at, @by, @at)`);
  const seeded = db.transaction((): number => {
    if (db.prepare("SELECT 1 AS n FROM console_seeds WHERE name = ?").get(MAIL_TEMPLATES_SEED)) return 0;
    let inserted = 0;
    for (const template of SEED_TEMPLATES) {
      const { content } = template;
      // 每类信的 DEFAULT_TEMPLATES 那一套是该类的默认模板，额外的几套不是
      inserted += insert.run({
        id: template.id, name: template.name, kind: template.kind, subject: content.subject, preheader: content.preheader, kicker: content.kicker,
        greeting: content.greeting, blocks: JSON.stringify(content.blocks), button_label: content.button?.label ?? null, button_path: content.button?.path ?? null,
        footer: JSON.stringify(content.footer), is_default: DEFAULT_TEMPLATES[template.kind].id === template.id ? 1 : 0, by: SEEDED_BY, at: now,
      }).changes;
    }
    db.prepare("INSERT OR IGNORE INTO console_seeds(name, seeded_at) VALUES(?, ?)").run(MAIL_TEMPLATES_SEED, now);
    return inserted;
  })();
  return { rows_before: before, rows_after: rowCount(db), seeded_this_run: seeded };
}
