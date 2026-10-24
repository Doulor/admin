// 「代码仓库」窗口和终端 repos 命令读的公开项目（#274 的 GET /api/public/gitlab/projects，CONTRACT-274 §6）：
// 只有自建 GitLab 上 visibility=public 的项目；GitLab 没配或连不上时服务端回 { projects: [], unavailable: true }。
import { useEffect, useState } from "react";
import { api } from "@shared/lib/api";

export type CodeProject = { name: string; path: string; description: string; url: string; cloneUrl: string; activeAt: number | null };

export type CodeRepos = { status: "loading" } | { status: "ready"; projects: CodeProject[] } | { status: "unavailable" } | { status: "error" };

export const CODE_REPOS_URL = "/api/public/gitlab/projects";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const https = (value: unknown): string => (/^https?:\/\//.test(text(value)) ? text(value) : "");

/** 最近活动时间：GitLab 给的是 ISO 时间字符串，也认毫秒时间戳；读不出时为 null */
function readTime(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

/** 读接口响应：缺名字或地址的项目丢掉，按最近活动从新到旧排 */
export function readCodeRepos(body: unknown): CodeRepos {
  if (!isRecord(body) || !Array.isArray(body.projects)) return { status: "error" };
  if (body.unavailable === true) return { status: "unavailable" };
  const projects = body.projects.filter(isRecord).flatMap((item): CodeProject[] => {
    const name = text(item.name);
    const url = https(item.web_url);
    if (!name || !url) return [];
    return [{ name, path: text(item.path_with_namespace) || name, description: text(item.description), url, cloneUrl: https(item.http_url_to_repo), activeAt: readTime(item.last_activity_at) }];
  });
  return { status: "ready", projects: projects.sort((a, b) => (b.activeAt ?? 0) - (a.activeAt ?? 0)) };
}

export function useCodeRepos(): CodeRepos {
  const [state, setState] = useState<CodeRepos>({ status: "loading" });
  useEffect(() => {
    const controller = new AbortController();
    api<unknown>(CODE_REPOS_URL, { signal: controller.signal, headers: { Accept: "application/json" } }).then(
      (body) => {
        if (!controller.signal.aborted) setState(readCodeRepos(body));
      },
      () => {
        if (!controller.signal.aborted) setState({ status: "error" });
      },
    );
    return () => controller.abort();
  }, []);
  return state;
}
