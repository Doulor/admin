import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@shared": fileURLToPath(new URL("./app/web/shared", import.meta.url)),
      "react": fileURLToPath(new URL("./app/web/node_modules/react", import.meta.url)),
      "react-dom": fileURLToPath(new URL("./app/web/node_modules/react-dom", import.meta.url)),
      "react-router-dom": fileURLToPath(new URL("./app/web/node_modules/react-router-dom", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    restoreMocks: true,
    testTimeout: 20000,
    hookTimeout: 20000,
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "html", "json-summary"],
      reportsDirectory: "coverage",
      include: ["app/server/src/**", "app/console/src/**", "app/web/shared/**", "app/web/sites/**"],
      exclude: ["**/*.d.ts", "**/node_modules/**"],
    },
    maxWorkers: 2,
    minWorkers: 1,
  },
});
