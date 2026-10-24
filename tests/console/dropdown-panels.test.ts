import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Tuffex 默认用 panel-background="refraction" 画下拉面板，背后的字会透出来、带彩边（所有者 2026-10-24：
// 「所有的下拉框都不要这样的」）。控制台每个下拉都传 pure，库自带的不透明配方；TxBlockSelect 传不进去，不用它。
const SRC = fileURLToPath(new URL("../../app/console/src/", import.meta.url));
const DROPDOWNS = /<(TxSelect|TxSearchSelect|TxDropdownMenu|TxDropdownSubmenu|TxContextMenu|TxPopover)(?=\s|>)[^>]*>/g;

function vueFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? vueFiles(path) : entry.name.endsWith(".vue") ? [path] : [];
  });
}

describe("控制台的下拉面板不透明", () => {
  const files = vueFiles(SRC).map(path => ({ path: path.slice(SRC.length), text: readFileSync(path, "utf8") }));

  it("每个下拉都传 panel-background=\"pure\"", () => {
    const tags = files.flatMap(({ path, text }) => [...text.matchAll(DROPDOWNS)].map(match => ({ path, tag: match[0] })));
    expect(tags.length).toBeGreaterThanOrEqual(12);
    for (const { path, tag } of tags) expect(tag, path).toMatch(/\spanel-background="pure"/);
  });

  it("不用 TxBlockSelect", () => {
    for (const { path, text } of files) expect(text, path).not.toMatch(/<TxBlockSelect\b/);
  });
});
