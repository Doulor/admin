import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { loadSession } from "../../lib/session.js";

/**
 * 比赛官网的同域托管（#278，CONTRACT-278 §1）：`/c/<slug>/…` 读已发布版本的文件，`/c/<slug>/~preview/<version_id>/…` 读任一通过校验的版本。
 * 所有响应带同一份 sandbox CSP：页面的来源是 null，读不到主站的 cookie 和存储，只能匿名调同源的 /api/public/*。
 * 不设 cookie，也不回 Set-Cookie。比赛下线、不是内部赛、没发布或文件不存在都是 404。
 * 预览：直接打开 `~preview/<version_id>/` 时检查会话有没有 competition.site.publish（没有也回 404，不暴露版本在不在），
 * 通过后跳到带签名的 `~preview/<version_id>.<到期>.<签名>/`。sandbox 页面里的子资源请求不带 cookie，所以后面的文件靠这段签名放行，一小时后失效。
 * 模块脚本和带 crossorigin 的样式按 CORS 方式请求（来源 null），所以文件响应也带 `Access-Control-Allow-Origin: *`。
 */
export const SITE_CSP = "sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox; default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; frame-ancestors 'none'";
const PREVIEW_PREFIX = "~preview/";
// 回的是文件或跳转，不是 JSON：Schema 只登记状态码与内容类型（Buffer 与 text/plain 不经过序列化）
const missingPage = { type: "string", description: "text/plain; charset=utf-8：没有这个页面" };
const redirectSchema = { schema: { response: { 301: { type: "string", description: "跳到带 / 的地址" }, 404: missingPage } } };
const fileSchema = {
  schema: {
    response: {
      200: { type: "string", description: "站点文件，Content-Type 按扩展名" },
      301: { type: "string", description: "目录或预览地址补 /" },
      302: { type: "string", description: "预览：换成一小时有效的签名地址" },
      404: missingPage,
    },
  },
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export default async function siteRoutes(app: FastifyInstance) {
  const { competitionSites: sites, competitions, permissions, clock } = app.services;

  app.addHook("onSend", async (_req, reply, payload) => {
    reply.header("Content-Security-Policy", SITE_CSP);
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
    reply.header("Access-Control-Allow-Origin", "*");
    reply.removeHeader("set-cookie");
    return payload;
  });

  const missing = (reply: FastifyReply) => reply.code(404).header("Cache-Control", "no-store").type("text/plain; charset=utf-8").send("没有这个页面");

  /** 内部赛、没下线：只有这样的比赛的官网对外可见。 */
  const hostable = (competitionId: string) => {
    const record = competitions.get(competitionId);
    return Boolean(record && !record.offline && record.kind === "internal");
  };

  function serve(reply: FastifyReply, competitionId: string, versionId: string, path: string, cacheControl: string) {
    const hit = sites.readSiteFile(competitionId, versionId, path);
    if (hit.kind === "redirect") return reply.header("Cache-Control", "no-store").redirect(hit.location, 301);
    if (hit.kind === "missing") return missing(reply);
    return reply.header("Cache-Control", cacheControl).type(hit.contentType).send(hit.data);
  }

  app.get<{ Params: { slug: string } }>("/c/:slug", redirectSchema, async (req, reply) => reply.header("Cache-Control", "no-store").redirect(`/c/${encodeURIComponent(req.params.slug)}/`, 301));

  app.get<{ Params: { slug: string; "*": string } }>("/c/:slug/*", fileSchema, async (req: FastifyRequest<{ Params: { slug: string; "*": string } }>, reply) => {
    const { slug } = req.params;
    const rest = req.params["*"] ?? "";
    if (rest === "~preview" || rest.startsWith(PREVIEW_PREFIX)) {
      const after = rest.slice(PREVIEW_PREFIX.length);
      const slash = after.indexOf("/");
      const segment = slash < 0 ? after : after.slice(0, slash);
      const inner = slash < 0 ? null : after.slice(slash + 1);
      const competitionId = sites.competitionForPreview(slug);
      if (!competitionId || !segment || !competitions.get(competitionId)) return missing(reply);
      if (UUID.test(segment)) {
        if (!loadSession(req) || !permissions.check(req.session!.account_id, "competition.site.publish") || !sites.passedVersion(competitionId, segment)) return missing(reply);
        const token = sites.previewToken(competitionId, segment, clock());
        return reply.header("Cache-Control", "no-store").redirect(`/c/${encodeURIComponent(slug)}/~preview/${token}/${(inner ?? "").split("/").map(encodeURIComponent).join("/")}`, 302);
      }
      const versionId = sites.verifyPreviewToken(competitionId, segment, clock());
      if (!versionId || !sites.passedVersion(competitionId, versionId)) return missing(reply);
      if (inner === null) return reply.header("Cache-Control", "no-store").redirect(`${segment}/`, 301);
      return serve(reply, competitionId, versionId, inner, "private, no-store");
    }
    const live = sites.live(slug);
    if (!live || !hostable(live.competition_id)) return missing(reply);
    return serve(reply, live.competition_id, live.version_id, rest, "public, max-age=300");
  });
}
