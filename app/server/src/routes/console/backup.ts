import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { REPO_ROOT } from "../../config.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { requirePermission } from "../../middleware/require-permission.js";
import { requireStepUp } from "../../middleware/require-step-up.js";
import { beijingCompactDate } from "../../lib/beijing-time.js";
import { prepareSystemBackup, readEnvKeyNames } from "../../lib/system-backup.js";

const byAccount = (req: FastifyRequest) => req.session!.account_id;

/** 环境变量名单按当前环境读 `deploy/env/.env.<environment>`；本机开发和测试没有自己的文件，按预发布那份列。 */
const envFileName = (environment: string | undefined) => (environment === "production" ? "production" : "preview");

const appVersion = (() => {
  try {
    const pkg = JSON.parse(readFileSync(resolve(REPO_ROOT, "package.json"), "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
})();

/**
 * 一键系统备份（#282，所有者 2026-10-24 22:22：论坛和所有数据要能一键导出下载，方便挂了或搬迁时恢复）。
 * 节点 `system.backup`：归档里带着全部账号与密码哈希，种子里不往下发给部门部长，只有站长的根通配 `*`
 * 默认拿到（见 lib/permission-nodes.ts、lib/migrations/2026-10-yugc-v2.ts 的 entrySeeds）。
 * 内容、排除项与怎么恢复见 docs/ops/BACKUP.md；恢复脚本是 scripts/backup-restore.mjs。
 */
export default async function consoleBackupRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);
  app.get(
    "/api/console/backup",
    {
      // 归档带着全部账号与密码哈希：和控制台的写操作一样要求刚登录过（10 分钟内）。
      preHandler: [requirePermission("system.backup"), requireStepUp],
      // 归档要重新打一遍（在线备份 + 清空短时数据 + 两遍算 sha256），单账号 5 分钟一次足够应付「搬迁前
      // 点一下」这种使用场景，也避免被连续点击当成压测。
      config: { rateLimit: { max: 1, timeWindow: "5 minutes", keyGenerator: byAccount, hook: "preHandler" } },
      // 响应是流，Fastify 对 stream payload 直接 pipe、跳过按 schema 序列化（v5 文档：Stream 类型不做校验和序列化），
      // 这里的 schema 只用来在契约里说清楚这是二进制归档，不会影响实际下载。
      schema: {
        response: {
          200: { description: "tar.gz 二进制归档流：manifest.json + data.db 快照 + sites/ 下的站点文件", type: "string", contentMediaType: "application/gzip" },
        },
      },
    },
    async (req, reply) => {
      const { manifest, stream } = await prepareSystemBackup({
        db: app.services.storage.db,
        sitesRoot: app.services.sitesRoot,
        environment: process.env.GEEK_DEPLOYMENT_ENVIRONMENT ?? "local",
        imageTag: process.env.IMAGE_TAG ?? null,
        appVersion,
        requiredEnv: readEnvKeyNames(resolve(REPO_ROOT, `deploy/env/.env.${envFileName(process.env.GEEK_DEPLOYMENT_ENVIRONMENT)}`)),
      });
      // 只记 manifest 摘要（文件数、表名、排除了哪些表），不记归档内容本身。
      app.services.activity.recordActivity(req, {
        action: "system.backup.export",
        surface: "console",
        outcome: "ok",
        meta: {
          environment: manifest.environment,
          files: manifest.files.length,
          tables: manifest.database.tables.length,
          excluded_tables: manifest.database.excluded_tables,
        },
      });
      reply.header("content-type", "application/gzip");
      reply.header("content-disposition", `attachment; filename="yzgc-backup-${manifest.environment}-${beijingCompactDate(Date.now())}.tar.gz"`);
      return reply.send(stream);
    },
  );
}
