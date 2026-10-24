import { defineConfig, type Plugin } from "vite";
import { fileURLToPath } from "node:url";
import { manifest } from "./site.config";

const here = fileURLToPath(new URL(".", import.meta.url));

/** 站点包根目录的 yzgc-site.json：内容来自 site.config.ts，和页面用的兜底时间是同一份。 */
function siteManifest(): Plugin {
  return {
    name: "yzgc-site-manifest",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "yzgc-site.json", source: `${JSON.stringify(manifest(), null, 2)}\n` });
    },
  };
}

/**
 * 第一期比赛官网（#278）单独构建成站点包：相对路径（base "./"），托管在 /c/<slug>/ 或预览地址下都能用；
 * 产物在 dist/site，`node scripts/contest-site.mjs pack` 再打成 zip。开发时 /api 转到本机 server。
 */
export default defineConfig({
  root: here,
  base: "./",
  publicDir: false,
  resolve: { alias: { "@shared": fileURLToPath(new URL("../../../shared", import.meta.url)) } },
  plugins: [siteManifest()],
  server: {
    port: 5195,
    proxy: { "/api": "http://127.0.0.1:3000" },
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
