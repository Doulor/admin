import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import {
  DEFAULT_TEMPLATES, RECRUITMENT_KINDS, kindLabel,
  type RecruitmentKind, type TemplateBlock, type TemplateContent,
} from "./template-content.js";

/**
 * 招聘邮件模板的库（#285，表 mail_templates 由 lib/migrations/2026-10-mail-templates.ts 建）。
 * 这里只管读写和「每类信有且只有一个默认、默认不能停用或删除、同类里名字不重复」这几条规则；
 * 内容合不合规（变量、长度、按钮路径）由调用方先过 template-content.ts 的 normalizeContent，再存规整后的内容。
 */

export type MailTemplate = {
  id: string;
  name: string;
  kind: RecruitmentKind;
  enabled: boolean;
  is_default: boolean;
  content: TemplateContent;
  created_by: string;
  created_at: number;
  updated_by: string;
  updated_at: number;
};

/** 改状态时下拉框里的一项 */
export type TemplateOption = { id: string; name: string; is_default: boolean };

/** 选出来用的模板；id 为 null 表示库里这一类一套也没有，用了代码里的内置默认 */
export type PickedTemplate = { id: string | null; name: string; content: TemplateContent };

export type TemplateStoreErrorCode = "not_found" | "name_taken" | "default_locked" | "changed" | "kind_mismatch" | "disabled";
export class TemplateStoreError extends Error {
  constructor(readonly code: TemplateStoreErrorCode, message: string) {
    super(message);
  }
}

type Row = {
  id: string; name: string; kind: RecruitmentKind; subject: string; preheader: string; kicker: string; greeting: string;
  blocks: string; button_label: string | null; button_path: string | null; footer: string; enabled: number; is_default: number;
  created_by: string; created_at: number; updated_by: string; updated_at: number;
};

const COLUMNS = "id, name, kind, subject, preheader, kicker, greeting, blocks, button_label, button_path, footer, enabled, is_default, created_by, created_at, updated_by, updated_at";
/** 列表的顺序：先按信的类别，类别里默认的排前面，再按名字 */
const ORDER = "ORDER BY CASE kind WHEN 'received' THEN 0 WHEN 'interview' THEN 1 WHEN 'accepted' THEN 2 ELSE 3 END, is_default DESC, name COLLATE NOCASE, id";

function toTemplate(row: Row): MailTemplate {
  return {
    id: row.id, name: row.name, kind: row.kind, enabled: row.enabled === 1, is_default: row.is_default === 1,
    content: {
      subject: row.subject, preheader: row.preheader, kicker: row.kicker, greeting: row.greeting,
      blocks: JSON.parse(row.blocks) as TemplateBlock[],
      button: row.button_label !== null && row.button_path !== null ? { label: row.button_label, path: row.button_path } : null,
      footer: JSON.parse(row.footer) as string[],
    },
    created_by: row.created_by, created_at: row.created_at, updated_by: row.updated_by, updated_at: row.updated_at,
  };
}

export type NewTemplate = { name: string; kind: RecruitmentKind; enabled: boolean; content: TemplateContent };
/** 改一套模板：没给的项不动；is_default 只能设成 true（换默认就是把另一套设为默认） */
export type TemplatePatch = { name?: string; enabled?: boolean; content?: TemplateContent; is_default?: true };

export function createTemplateStore(db: Database.Database) {
  const byId = db.prepare(`SELECT ${COLUMNS} FROM mail_templates WHERE id = ?`);
  const all = db.prepare(`SELECT ${COLUMNS} FROM mail_templates ${ORDER}`);
  const defaultOf = db.prepare(`SELECT ${COLUMNS} FROM mail_templates WHERE kind = ? AND is_default = 1`);
  const sameName = db.prepare("SELECT id FROM mail_templates WHERE kind = ? AND name = ? COLLATE NOCASE AND id != ?");
  const insert = db.prepare(`INSERT INTO mail_templates
    (id, name, kind, subject, preheader, kicker, greeting, blocks, button_label, button_path, footer, enabled, is_default, created_by, created_at, updated_by, updated_at)
    VALUES (@id, @name, @kind, @subject, @preheader, @kicker, @greeting, @blocks, @button_label, @button_path, @footer, @enabled, @is_default, @by, @at, @by, @at)`);
  const update = db.prepare(`UPDATE mail_templates SET name = @name, subject = @subject, preheader = @preheader, kicker = @kicker, greeting = @greeting,
    blocks = @blocks, button_label = @button_label, button_path = @button_path, footer = @footer, enabled = @enabled, updated_by = @by, updated_at = @at WHERE id = @id`);
  const clearDefault = db.prepare("UPDATE mail_templates SET is_default = 0 WHERE kind = ? AND is_default = 1");
  const setDefaultFlag = db.prepare("UPDATE mail_templates SET is_default = 1 WHERE id = ?");
  const remove = db.prepare("DELETE FROM mail_templates WHERE id = ?");

  const get = (id: string): MailTemplate | null => {
    const row = byId.get(id) as Row | undefined;
    return row ? toTemplate(row) : null;
  };
  const must = (id: string): MailTemplate => {
    const found = get(id);
    if (!found) throw new TemplateStoreError("not_found", "模板不存在");
    return found;
  };
  function assertNameFree(kind: RecruitmentKind, name: string, exceptId: string) {
    if (sameName.get(kind, name, exceptId)) throw new TemplateStoreError("name_taken", `「${kindLabel(kind)}」里已经有一套叫「${name}」的模板`);
  }
  const columns = (template: { name: string; enabled: boolean; content: TemplateContent }) => ({
    name: template.name, subject: template.content.subject, preheader: template.content.preheader, kicker: template.content.kicker,
    greeting: template.content.greeting, blocks: JSON.stringify(template.content.blocks),
    button_label: template.content.button?.label ?? null, button_path: template.content.button?.path ?? null,
    footer: JSON.stringify(template.content.footer), enabled: template.enabled ? 1 : 0,
  });

  const list = (): MailTemplate[] => (all.all() as Row[]).map(toTemplate);
  const defaultFor = (kind: RecruitmentKind): MailTemplate | null => {
    const row = defaultOf.get(kind) as Row | undefined;
    return row ? toTemplate(row) : null;
  };

  return {
    list,
    get,
    defaultFor,
    /** 这一类信现在默认用的内容：库里的默认；这一类一套也没有时用代码里的内置默认 */
    defaultContent(kind: RecruitmentKind): TemplateContent {
      return defaultFor(kind)?.content ?? DEFAULT_TEMPLATES[kind].content;
    },
    /** 每一类信里启用的模板，给改状态的下拉框用（只有名字，没有内容） */
    enabledOptions(): Record<RecruitmentKind, TemplateOption[]> {
      const options = Object.fromEntries(RECRUITMENT_KINDS.map(kind => [kind, [] as TemplateOption[]])) as Record<RecruitmentKind, TemplateOption[]>;
      for (const template of list()) if (template.enabled) options[template.kind].push({ id: template.id, name: template.name, is_default: template.is_default });
      return options;
    },
    /**
     * 改状态时选信：没指定就用这一类的默认；指定了就必须存在、是这一类、已启用。
     * 选不出来抛 TemplateStoreError（not_found / kind_mismatch / disabled）。
     */
    pick(kind: RecruitmentKind, id?: string): PickedTemplate {
      if (id === undefined) {
        const found = defaultFor(kind);
        return found ? { id: found.id, name: found.name, content: found.content } : { id: null, name: DEFAULT_TEMPLATES[kind].name, content: DEFAULT_TEMPLATES[kind].content };
      }
      const found = get(id);
      if (!found) throw new TemplateStoreError("not_found", "选的信不存在");
      if (found.kind !== kind) throw new TemplateStoreError("kind_mismatch", `选的信是「${kindLabel(found.kind)}」这一类的，这次要发的是「${kindLabel(kind)}」`);
      if (!found.enabled) throw new TemplateStoreError("disabled", `选的信「${found.name}」已经停用`);
      return { id: found.id, name: found.name, content: found.content };
    },
    /** 新建一套。这一类还没有默认、而且新模板是启用的，它就成为默认。 */
    create(input: NewTemplate, by: string, at: number): MailTemplate {
      return db.transaction((): MailTemplate => {
        assertNameFree(input.kind, input.name, "");
        const id = randomUUID();
        const becomesDefault = input.enabled && !defaultOf.get(input.kind);
        insert.run({ id, kind: input.kind, ...columns(input), is_default: becomesDefault ? 1 : 0, by, at });
        return must(id);
      })();
    },
    /**
     * 改一套。expectedUpdatedAt 给了而库里的更新时间不同，说明别人改过，抛 changed。
     * 默认模板不能停用；停用的模板不能设为默认；换默认时旧的默认同时取消。
     * 只改默认标记不算改内容，更新人和更新时间不动。
     */
    update(id: string, patch: TemplatePatch, by: string, at: number, expectedUpdatedAt?: number): MailTemplate {
      return db.transaction((): MailTemplate => {
        const current = must(id);
        if (expectedUpdatedAt !== undefined && expectedUpdatedAt !== current.updated_at) throw new TemplateStoreError("changed", "这套模板刚被别人改过，刷新后再改");
        const next = { name: patch.name ?? current.name, enabled: patch.enabled ?? current.enabled, content: patch.content ?? current.content };
        if (!next.enabled && current.is_default) throw new TemplateStoreError("default_locked", "默认的模板不能停用，先把同一类里的另一套设为默认");
        if (patch.is_default && !next.enabled) throw new TemplateStoreError("disabled", "停用的模板不能设为默认");
        if (next.name !== current.name) assertNameFree(current.kind, next.name, id);
        const edited = patch.name !== undefined || patch.enabled !== undefined || patch.content !== undefined;
        if (edited) update.run({ id, ...columns(next), by, at });
        if (patch.is_default && !current.is_default) {
          clearDefault.run(current.kind);
          setDefaultFlag.run(id);
        }
        return must(id);
      })();
    },
    /** 删一套。默认的不能删。 */
    delete(id: string): MailTemplate {
      return db.transaction((): MailTemplate => {
        const current = must(id);
        if (current.is_default) throw new TemplateStoreError("default_locked", "默认的模板不能删除，先把同一类里的另一套设为默认");
        remove.run(id);
        return current;
      })();
    },
  };
}

export type TemplateStore = ReturnType<typeof createTemplateStore>;
