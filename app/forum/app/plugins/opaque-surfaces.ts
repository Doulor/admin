import { setSurfacePerformanceMode } from '@talex-touch/tuffex/base-surface'

/**
 * Tuffex draws dropdown, dialog, drawer and command-palette panels with the
 * refraction material by default: the panel bends the page behind it, so on
 * the forum's near-white pages the text underneath shows through with coloured
 * fringes (owner, 2026-10-24: 「所有的下拉框都不要这样的」). This page-wide switch
 * draws every refraction, glass, acrylic, blur and mica surface as the opaque
 * `flat` one instead. Dropdowns also pass panel-background="pure" themselves
 * (tests/dropdown-panels.test.ts).
 */
export default defineNuxtPlugin({
  name: 'geek-opaque-surfaces',
  setup() {
    setSurfacePerformanceMode('max')
  },
})
