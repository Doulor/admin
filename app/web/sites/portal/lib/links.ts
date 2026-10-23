// 官网所有「去别处」的链接只在这里解析一次：论坛（首页 / 版块 / 话题）、控制台、GitHub 组织、自建的 GitLab（#270）。
// 站内页面（/join-us、/feedback、/docs）用 React Router 的 Link，不经过这里。
// 生产：论坛在官网域名的 /forum/ 下，控制台在管理端域名的 /console；开发：论坛 127.0.0.1:3456，控制台 /sites/admin/console。
import { appConfig } from "@shared/config";
import { externalUrl } from "@shared/lib/site";

export const links = {
  forumHome: (): string => externalUrl("forum", "/"),
  forumCategory: (slug: string): string => externalUrl("forum", `/c/${encodeURIComponent(slug)}`),
  // 论坛话题页按话题 id 解析（/t/<id>，例如 /t/t84），不是 slug
  forumTopic: (id: string): string => externalUrl("forum", `/t/${encodeURIComponent(id)}`),
  console: (): string => externalUrl("admin", "/console"),
  githubOrg: (): string => appConfig.urls.githubOrg,
  gitlab: (): string => appConfig.urls.gitlab,
};
