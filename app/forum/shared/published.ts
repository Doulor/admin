import type { Category, ForumState, Post, Tag, Topic, User } from '../app/data/types'
import { categories as curatedCategories, categoryOrder, tags as curatedTags } from '../content/curation.json'
import published from '../content/published/topics.json'
import { emptyForumState } from './local-snapshot'

/**
 * The old-forum documents 极客班论坛 publishes (#87): `content/published/topics.json`,
 * written by `scripts/forum-migration/export-published.mjs` from the private
 * snapshot after redaction. Every topic is attributed to the 极客班 account
 * and carries only its opening post; replies stay in the private archive.
 */

export interface PublishedContent {
  users: User[]
  topics: Topic[]
  posts: Post[]
}

export function publishedTopicIds(): string[] {
  return published.topics.map(topic => topic.id)
}

export function publishedContent(): PublishedContent {
  const { author } = published
  const joinedAt = Math.min(...published.topics.map(topic => topic.createdAt))
  const user: User = {
    id: author.id,
    username: author.username,
    displayName: author.displayName,
    bio: author.bio,
    location: '',
    website: '',
    avatarColor: author.avatarColor,
    joinedAt,
    role: author.role as User['role'],
    notifyPrefs: { reply: false, like: false, follow: false },
  }
  const topics: Topic[] = published.topics.map(topic => ({
    id: topic.id,
    slug: topic.slug,
    title: topic.title,
    categoryId: topic.categoryId,
    tagIds: [...topic.tagIds],
    authorId: author.id,
    createdAt: topic.createdAt,
    lastActivityAt: topic.lastActivityAt,
    views: topic.views,
    pinned: topic.pinned,
    closed: false,
  }))
  const posts: Post[] = published.topics.map(topic => ({
    id: `body-${topic.id.slice(1)}`,
    topicId: topic.id,
    authorId: author.id,
    content: topic.content,
    createdAt: topic.createdAt,
    likeUserIds: [],
  }))
  return { users: [user], topics, posts }
}

/**
 * Source-only projection used by deterministic publication checks and export
 * tooling. Site client code must not import this module; live site content is
 * always supplied by core after viewer authorization.
 */
export function publishedForumState(): ForumState {
  const { users, topics, posts } = publishedContent()
  const referencedCategories = new Set(topics.map(topic => topic.categoryId))
  const rank = new Map(categoryOrder.map((id, index) => [id, index]))
  const categories: Category[] = curatedCategories
    .filter(category => referencedCategories.has(category.id))
    .map((category, index) => ({ category, index }))
    .sort((a, b) => (rank.get(a.category.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.category.id) ?? Number.MAX_SAFE_INTEGER) || a.index - b.index)
    .map(({ category: { id, slug, name, description, color, icon } }) => ({ id, slug, name, description, color, icon }))
  const tags: Tag[] = curatedTags.map(({ id, slug, name, color }) => ({ id, slug, name, color }))
  const empty = emptyForumState()
  return {
    ...empty,
    counters: {
      ...empty.counters,
      topic: Math.max(0, ...topics.map(topic => Number(topic.id.slice(1)))),
      post: posts.length,
      tag: tags.length,
    },
    users,
    categories,
    tags,
    topics,
    posts,
  }
}
