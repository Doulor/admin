import type { FastifyInstance } from "fastify";

const PUBLIC_PROJECTS_CACHE_KEY = "gitlab:public-projects";
const PUBLIC_PROJECTS_CACHE_TTL_MS = 5 * 60_000;

/**
 * 公开的代码仓库列表（#274）：门户「代码仓库」应用用它，只给 `visibility = public` 的项目，不需要登录。
 * GitLab 没配或连不上时给空列表加 `unavailable: true`，不让门户跟着报错。
 */
export default async function portalGitlabRoutes(app: FastifyInstance) {
  const { gitlab, cache } = app.services;
  app.get("/api/public/gitlab/projects", async () => {
    const { projects, available } = await cache.cached(PUBLIC_PROJECTS_CACHE_KEY, PUBLIC_PROJECTS_CACHE_TTL_MS, () => gitlab.listProjects());
    if (!available) return { projects: [], unavailable: true };
    return {
      projects: projects.filter(project => project.visibility === "public")
        .map(({ name, path_with_namespace, description, web_url, http_url_to_repo, last_activity_at }) =>
          ({ name, path_with_namespace, description, web_url, http_url_to_repo, last_activity_at })),
    };
  });
}
