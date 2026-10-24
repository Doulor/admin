import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

/**
 * 比赛官网 SDK（#278）单独构建成一个 ESM 文件 dist/sdk/competition/v1.js，跟着官网产物进 web 镜像，
 * 由 nginx 在 /sdk/competition/v1.js 提供。在主构建之后跑，不清空 dist、不复制 public/。
 */
export default defineConfig({
  publicDir: false,
  build: {
    outDir: fileURLToPath(new URL("./dist/sdk/competition", import.meta.url)),
    emptyOutDir: false,
    sourcemap: false,
    target: "es2020",
    lib: {
      entry: fileURLToPath(new URL("./shared/competition-sdk/index.ts", import.meta.url)),
      formats: ["es"],
      fileName: () => "v1.js",
    },
  },
});
