import type {
  ForumPost, ForumPostExcerpt, ForumStateBody, ForumTopic, ForumUser,
} from "./forum-store.js";

/** 核心服务按当前 viewer 生成的论坛文档；不读取论坛静态产物。 */
export type ForumMarkdownState = Omit<ForumStateBody, "posts"> & { posts: Array<ForumPost | ForumPostExcerpt> };

export type ForumMarkdownSite = {
  siteName: string;
  origin: string;
  basePath: string;
  notice: string;
};

const UNKNOWN_USER = "未知用户";
const SUMMARY_LENGTH = 80;
export const NO_TOPICS = "还没有当前身份可以查看的话题。";

export function forumTopicMarkdownPath(topicId: string): string {
  return `t/${encodeURIComponent(topicId)}.md`;
}

/** 标题、名字与摘要是纯文本；折叠空白并转义 Markdown 行内符号。 */
export function escapeForumMarkdownInline(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[\\`*_[\]<~]/g, "\\$&")
    .replace(/&(?=#?\w+;)/g, "\\&");
}

/** `/forum/llms.txt`：输入已经由 forum-store 按 viewer 的有效可见性过滤。 */
export function forumLlmsTxt(state: ForumMarkdownState, site: ForumMarkdownSite): string {
  const lines = [
    `# ${escapeForumMarkdownInline(site.siteName)}`,
    "",
    `> ${escapeForumMarkdownInline(site.siteName)} 的话题索引。每个链接都是按当前访问者权限实时生成的 Markdown 文档。${site.notice}`,
    "",
  ];

  if (state.topics.length === 0) lines.push(NO_TOPICS, "");

  for (const category of state.categories) {
    const topics = state.topics.filter(topic => topic.categoryId === category.id).sort(topicOrder);
    if (topics.length === 0) continue;
    lines.push(`## ${escapeForumMarkdownInline(category.name)}`, "");
    for (const topic of topics) {
      const first = postsInFloorOrder(state, topic.id)[0];
      const summary = first && !first.deleted && "excerpt" in first
        ? escapeForumMarkdownInline(first.excerpt.slice(0, SUMMARY_LENGTH))
        : "";
      const link = `[${escapeForumMarkdownInline(topic.title)}](${siteUrl(site, forumTopicMarkdownPath(topic.id))})`;
      lines.push(summary ? `- ${link}: ${summary}` : `- ${link}`);
    }
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

/** `/forum/t/<id>.md`：话题已由路由按当前 viewer 鉴权，正文来自同一核心数据库。 */
export function forumTopicMarkdown(state: ForumMarkdownState, topicId: string, site: ForumMarkdownSite): string | null {
  const topic = state.topics.find(candidate => candidate.id === topicId);
  if (!topic) return null;

  const users = new Map(state.users.map(user => [user.id, user]));
  const posts = postsInFloorOrder(state, topic.id);
  const floors = new Map(posts.map((post, index) => [post.id, index + 1]));
  const [first, ...replies] = posts;
  const author = users.get(topic.authorId);
  const category = state.categories.find(candidate => candidate.id === topic.categoryId);
  const tags = topic.tagIds
    .map(id => state.tags.find(tag => tag.id === id)?.name)
    .filter((name): name is string => name !== undefined);

  const lines = [
    "---",
    `title: ${JSON.stringify(topic.title)}`,
    `category: ${JSON.stringify(category?.name ?? "")}`,
    `author: ${JSON.stringify(author?.displayName ?? UNKNOWN_USER)}`,
    `author_username: ${JSON.stringify(author?.username ?? "")}`,
    `created: ${JSON.stringify(new Date(topic.createdAt).toISOString())}`,
    ...(tags.length ? [`tags: ${JSON.stringify(tags)}`] : []),
    `replies: ${replies.filter(post => !post.deleted).length}`,
    `url: ${JSON.stringify(siteUrl(site, `t/${encodeURIComponent(topic.id)}`))}`,
    "---",
    "",
    `# ${escapeForumMarkdownInline(topic.title)}`,
    "",
    first ? postBody(first) : "（正文缺失）",
    "",
    "## 回复",
    "",
  ];

  if (replies.length === 0) lines.push("暂无回复。", "");
  for (const reply of replies) {
    lines.push(`### #${floors.get(reply.id)} ${byline(users.get(reply.authorId))} · ${new Date(reply.createdAt).toISOString()}`, "");
    const target = reply.replyToPostId ? posts.find(post => post.id === reply.replyToPostId) : undefined;
    if (target && floors.has(target.id)) lines.push(`回复 #${floors.get(target.id)} ${byline(users.get(target.authorId))}`, "");
    lines.push(postBody(reply), "");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function postsInFloorOrder(state: ForumMarkdownState, topicId: string): Array<ForumPost | ForumPostExcerpt> {
  return state.posts.filter(post => post.topicId === topicId).sort((a, b) => a.createdAt - b.createdAt);
}

function postBody(post: ForumPost | ForumPostExcerpt): string {
  if (post.deleted) return "（此帖已被删除）";
  if (!("content" in post)) return "（正文缺失）";
  return post.content.replace(/^(?:[ \t]*\n)+/, "").trimEnd() || "（空）";
}

function topicOrder(a: ForumTopic, b: ForumTopic): number {
  return Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt || a.id.localeCompare(b.id);
}

function byline(user: ForumUser | undefined): string {
  return user ? `${escapeForumMarkdownInline(user.displayName)} (@${escapeForumMarkdownInline(user.username)})` : UNKNOWN_USER;
}

function siteUrl(site: ForumMarkdownSite, path: string): string {
  return `${site.origin}${site.basePath}${path}`;
}
