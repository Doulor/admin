// 比赛官网起步模板（#278）：复制整个 `_starter` 目录改成 `sites/contests/<新比赛的 slug>/`，
// 这份文件是唯一要先改的地方——改完 `competition_id`、`name`，站点包的清单（yzgc-site.json）就对了。
//
// 新比赛的接入步骤（完整版见 docs/services/server/contest-site-quickstart.md）：
// 1. 复制目录：`cp -r app/web/sites/contests/_starter app/web/sites/contests/<新比赛的 slug>`
// 2. 改这份文件的 `competition_id`（控制台建比赛时拿到的 id）和 `name`
// 3. 在 `app/web/package.json` 里加两行脚本（抄 `build:contest` / `dev:contest`，把路径换成新目录）
// 4. 开发时先用 `node scripts/contest-site.mjs dev <构建产物目录>` 看带示例数据的效果，再接真实后端调试
// 5. 构建、打包、上传、预览、发布：同上面提到的 quickstart 文档
export const SITE = {
  name: "示例赛官网",
  version: "0.1.0",
  sdk: "competition/v1",
  /** 控制台建比赛之后拿到的 id；不填时站点包校验不认这场比赛（只在上传到具体比赛时才比对）。 */
  competition_id: "",
} as const;

export function manifest() {
  return { name: SITE.name, version: SITE.version, sdk: SITE.sdk, ...(SITE.competition_id ? { competition_id: SITE.competition_id } : {}) };
}
