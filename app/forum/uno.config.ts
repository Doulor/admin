import { fileURLToPath } from 'node:url'
import { defineConfig, presetIcons, presetWind3 } from 'unocss'
import curation from './content/curation.json'
import { tuffexIconClasses } from './scripts/tuffex-icon-classes.mjs'

const iconClassesScript = fileURLToPath(
  new URL('./scripts/tuffex-icon-classes.mjs', import.meta.url),
)
const curationFile = fileURLToPath(new URL('./content/curation.json', import.meta.url))

// Category icons in the read-only snapshot arrive as runtime data (the
// projection emits i-carbon-archive / i-carbon-forum; content/curation.json
// names the rest), so the scanner never sees them. List them explicitly or the
// category picker renders empty tiles.
const snapshotIconClasses = [
  'i-carbon-archive',
  'i-carbon-forum',
  curation.archive.icon,
  ...curation.categories.map(category => category.icon),
  ...Object.values(curation.categoryPatches as Record<string, { icon?: string }>).flatMap(patch => (patch.icon ? [patch.icon] : [])),
]

/**
 * #276's exception to R2 (no custom styling), registered in ADOPTION.json
 * (`styleExceptions`) and ADR-0003; the older `sidebar-tuned` rule below is
 * the other one. Theme variables, plus the editor's padding and the sticker
 * size, nothing that restyles a Tuffex component:
 *
 * - `html.sky`: the 晴空 theme, the boot animation's last frame (SPEC §1)
 *   written as Tuffex's own `--tx-*` tokens; @nuxtjs/color-mode puts the
 *   class on <html> when 设置 → 外观 picks it. Light and dark stay Tuffex's.
 * - `.milkdown`: Milkdown Crepe's `--crepe-*` variables pointed at the same
 *   `--tx-*` tokens, so the editor follows whichever theme is on. Crepe's
 *   own palette (theme/frame.css) is never loaded.
 * - `.forum-editor`: Crepe pads its page by 60px 120px, made for a full-page
 *   document; the composer gets a form field's padding (room on the left for
 *   Crepe's block handle) and the heights PostEditor offers. Like Bilibili's
 *   comment box (#276) it is a filled box that turns white with a primary
 *   border while focused; the row under it uses the regular text colour, not
 *   the faint secondary one.
 * - stickers: 4rem in posts (`.forum-sticker`), a 3rem picture in the line
 *   inside the editor; the files are 256px and would otherwise fill the line.
 */
const FORUM_THEME_CSS = `
html.sky {
  --tx-color-primary: #3a76d6;
  --tx-color-primary-rgb: 58 118 214;
  --tx-color-primary-light-3: #75a0e3;
  --tx-color-primary-light-5: #9dbbea;
  --tx-color-primary-light-7: #c4d6f3;
  --tx-color-primary-light-8: #d8e4f7;
  --tx-color-primary-light-9: #ebf1fb;
  --tx-color-primary-dark-2: #2e5eab;
  --tx-color-success: #1fb487;
  --tx-color-success-rgb: 31 180 135;
  --tx-text-color-primary: #1d2b53;
  --tx-text-color-regular: #2c3f6e;
  --tx-text-color-secondary: #4f6f9f;
  --tx-text-color-placeholder: #8aa4cc;
  --tx-border-color: #cfe2f7;
  --tx-border-color-light: #dbe9f9;
  --tx-border-color-lighter: #e6f0fb;
  --tx-border-color-extra-light: #eff6fd;
  --tx-fill-color: #e6f2ff;
  --tx-fill-color-light: #eef6ff;
  --tx-fill-color-lighter: #f4f9ff;
  --tx-fill-color-darker: #d6e9ff;
  --tx-fill-color-blank: #ffffff;
  --tx-bg-color: #ffffff;
  --tx-bg-color-page: #e3f2ff;
  --tx-bg-color-overlay: #ffffff;
  --tx-box-shadow: 0 12px 32px rgba(60, 110, 200, .18);
  --tx-box-shadow-light: 0 4px 14px rgba(60, 110, 200, .14);
  --tx-box-shadow-lighter: 0 2px 6px rgba(60, 110, 200, .12);
  --tx-font-family: "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif;
}
.milkdown {
  --crepe-color-background: var(--tx-bg-color);
  --crepe-color-on-background: var(--tx-text-color-primary);
  --crepe-color-surface: var(--tx-fill-color-light);
  --crepe-color-surface-low: var(--tx-fill-color);
  --crepe-color-on-surface: var(--tx-text-color-primary);
  --crepe-color-on-surface-variant: var(--tx-text-color-secondary);
  --crepe-color-outline: var(--tx-border-color);
  --crepe-color-primary: var(--tx-color-primary);
  --crepe-color-secondary: var(--tx-fill-color-darker);
  --crepe-color-on-secondary: var(--tx-text-color-primary);
  --crepe-color-inverse: var(--tx-fill-color-light);
  --crepe-color-on-inverse: var(--tx-text-color-primary);
  --crepe-color-inline-code: var(--tx-color-danger);
  --crepe-color-error: var(--tx-color-danger);
  --crepe-color-hover: var(--tx-fill-color);
  --crepe-color-selected: var(--tx-fill-color-darker);
  --crepe-color-inline-area: var(--tx-fill-color-darker);
  --crepe-base-font-size: 15px;
  --crepe-font-title: inherit;
  --crepe-font-default: inherit;
  --crepe-font-code: "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;
  --crepe-shadow-1: var(--tx-box-shadow-lighter);
  --crepe-shadow-2: var(--tx-box-shadow-light);
}
.forum-editor .milkdown .ProseMirror {
  padding: 12px 16px 12px 44px;
}
.forum-editor-96 .milkdown .ProseMirror { min-height: 96px; }
.forum-editor-200 .milkdown .ProseMirror { min-height: 200px; }
.forum-editor-240 .milkdown .ProseMirror { min-height: 240px; }
.forum-editor-320 .milkdown .ProseMirror { min-height: 320px; }
.forum-editor-400 .milkdown .ProseMirror { min-height: 400px; }
.forum-editor {
  border-color: transparent;
  background: var(--tx-fill-color-light);
  transition: background-color .15s, border-color .15s;
}
.forum-editor .milkdown { --crepe-color-background: transparent; background: transparent; }
.forum-editor:focus-within {
  border-color: var(--tx-color-primary);
  background: var(--tx-bg-color);
}
.forum-editor-toolbar .tx-button.variant-bare,
.forum-editor-hint,
.forum-editor-toolbar > :first-child > span {
  color: var(--tx-text-color-regular);
}
.forum-sticker {
  display: inline-block;
  width: 4rem;
  height: 4rem;
  object-fit: contain;
  vertical-align: bottom;
}
/* In the box a sticker sits in the line between words, as in Bilibili's comment box, at 48px: the stickers are whole figures with a word on them and turn into a smudge any smaller. */
.milkdown img[src^="/api/forum/stickers/"] {
  display: inline-block;
  width: 3rem;
  height: 3rem;
  margin: 0 2px;
  object-fit: contain;
  vertical-align: middle;
}
/* 回复 under the box is a solid button, like Bilibili's 发布; Tuffex's fake background would wash it out. */
.forum-editor-toolbar .tx-button.variant-primary.fake-background {
  --fake-opacity: 0;
  color: #fff;
  background: var(--tx-color-primary);
}
`

export default defineConfig({
  preflights: [{ getCSS: () => FORUM_THEME_CSS }],

  presets: [
    presetWind3(),
    presetIcons({ scale: 1.2 }),
  ],

  rules: [
    [/^sidebar-tuned$/, () => `
      .sidebar-tuned .tx-bui-sidebar-nav__label { font-size: 14px !important; }
      .sidebar-tuned .tx-bui-sidebar-nav__group-label { font-size: 12px !important; font-weight: 600 !important; }
      .sidebar-tuned .tx-bui-sidebar-nav__row { padding-top: 7px !important; padding-bottom: 7px !important; gap: 10px !important; }
      .sidebar-tuned .tx-bui-sidebar-nav__icon { font-size: 16px !important; width: 1.25rem !important; height: 1.25rem !important; }
    `],
  ],

  // Tuffex renders its own icons as `<i class="i-carbon-…">` from inside
  // node_modules, which UnoCSS never scans. Collect those classes from the
  // published dist so the rules exist regardless of what our templates use.
  safelist: [...new Set([...tuffexIconClasses(), ...snapshotIconClasses, 'sidebar-tuned'])],

  content: {
    pipeline: {
      include: [
        // UnoCSS defaults
        /\.(vue|svelte|[jt]sx|mdx?|astro|elm|php|phtml|html)($|\?)/,
        // Icon names kept in data modules (category icons, notification types).
        /app\/.*\.ts($|\?)/,
      ],
    },
  },

  // Re-run this config when the scanner or the curated icon list changes;
  // UnoCSS only watches the config file itself otherwise.
  configDeps: [iconClassesScript, curationFile],
})
