import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Run from the root with tests/integration/forum-editor/run.mjs. It starts the
// Node 22 HTTP fixture, runs this Node 26 suite, propagates failure and cleans
// up. jsdom is the existing root devDependency, not a forum/runtime dependency.
export default defineConfig({
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('../app', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/crepe-markdown.spec.ts'],
    testTimeout: 10000,
  },
})
