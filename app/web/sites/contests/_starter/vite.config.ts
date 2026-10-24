import { defineConfig, type Plugin } from "vite";
import { fileURLToPath } from "node:url";
import { manifest } from "./site.config";

const here = fileURLToPath(new URL(".", import.meta.url));

/** 站点包根目录的 yzgc-site.json：内容来自 site.config.ts，和 oss-2026-1 的写法一样。 */
function siteManifest(): Plugin {
  return {
    name: "yzgc-site-manifest",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "yzgc-site.json", source: `${JSON.stringify(manifest(), null, 2)}\n` });
    },
  };
}

/**
 * 比赛官网起步模板（#278）：复制这份文件到新目录后不用改——真正要改的是 site.config.ts 和同目录的 package.json
 * 脚本路径。构建成相对路径（base "./"），托管在 /c/<slug>/ 或预览地址下都能用；产物在 dist/site，
 * `node scripts/contest-site.mjs pack` 再打成 zip。本机开发时 /api 转到本机 server，默认端口 3000；
 * 设了 `CONTEST_API` 环境变量就转到它（例如 `CONTEST_API=https://prev.yangtzeu.work pnpm dev`，对接线上真实数据，
 * 见 docs/services/server/contest-site-quickstart.md「本地对接线上数据」）。
 */
export default defineConfig({
  root: here,
  base: "./",
  publicDir: false,
  resolve: { alias: { "@shared": fileURLToPath(new URL("../../../shared", import.meta.url)) } },
  plugins: [siteManifest()],
  server: {
    port: 5197,
    proxy: { "/api": process.env.CONTEST_API || "http://127.0.0.1:3000" },
  },
  build: {
    outDir: `${here}dist/site`,
    emptyOutDir: true,
    sourcemap: false,
    target: "es2020",
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
  },
});
