import { afterEach, describe, expect, it } from 'vitest';
import { setExclusiveGroupMembership } from '../../app/server/src/lib/permissions';
import type { ForumStateBody } from '../../app/server/src/lib/forum-store';
import { accountIdOf, grantPermNode, signIn, testApp } from './helpers';

const contexts: Awaited<ReturnType<typeof testApp>>[] = [];
afterEach(async () => {
  for (const context of contexts.splice(0)) await context.close();
});

type Persona = 'registered' | 'member' | 'alumni' | 'moderator';
const PERSONAS = [undefined, 'registered', 'member', 'alumni', 'moderator'] as const;
async function setup() {
  const context = await testApp();
  contexts.push(context);
  const { app } = context;
  const sids = new Map<Persona, string>();
  for (const [index, persona] of ['registered', 'member', 'alumni', 'moderator'].entries()) {
    sids.set(persona as Persona, signIn(app, `visibility_${persona}`, 27201 + index));
    const level = persona === 'moderator' ? 'member' : persona;
    setExclusiveGroupMembership(app.services.storage.db, accountIdOf(app, `visibility_${persona}`), `level.${level}`, Date.now(), 'test');
  }
  app.services.permissions.bump();
  const moderator = accountIdOf(app, 'visibility_moderator');
  grantPermNode(app, moderator, 'forum.category.manage');
  grantPermNode(app, moderator, 'forum.moderate.*', { category: ['c-exam', 'c-ai'] });

  const call = (method: 'GET' | 'HEAD' | 'POST' | 'PATCH', url: string, who?: Persona, payload?: unknown) =>
    app.inject({
      method, url,
      headers: { origin: 'https://example.test', ...(who ? { cookie: `sid=${sids.get(who)}` } : {}) },
      ...(payload === undefined ? {} : { payload }),
    });
  const category = async (id: string, visibility: 'public' | 'registered' | 'member') => {
    const result = await call('PATCH', `/api/console/forum/categories/${id}`, 'moderator', { visibility });
    expect(result.statusCode).toBe(200);
  };
  const state = async (who?: Persona): Promise<ForumStateBody> => {
    const response = await call('GET', '/api/forum/state', who);
    expect(response.statusCode).toBe(200);
    return response.json().state as ForumStateBody;
  };
  return { app, call, category, state };
}

function expectReferences(state: ForumStateBody) {
  const ids = (rows: { id: string }[]) => new Set(rows.map(row => row.id));
  const categories = ids(state.categories);
  const topics = ids(state.topics);
  const posts = ids(state.posts);
  const users = ids(state.users);
  const tags = ids(state.tags);
  for (const topic of state.topics) {
    expect(categories.has(topic.categoryId), `${topic.id}.categoryId`).toBe(true);
    expect(users.has(topic.authorId), `${topic.id}.authorId`).toBe(true);
    for (const tagId of topic.tagIds) expect(tags.has(tagId), `${topic.id}.tagIds`).toBe(true);
  }
  for (const post of state.posts) {
    expect(topics.has(post.topicId), `${post.id}.topicId`).toBe(true);
    expect(users.has(post.authorId), `${post.id}.authorId`).toBe(true);
    if (post.replyToPostId) expect(posts.has(post.replyToPostId), `${post.id}.replyToPostId`).toBe(true);
    for (const id of post.likeUserIds) expect(users.has(id), `${post.id}.likeUserIds`).toBe(true);
  }
  for (const bookmark of state.bookmarks) {
    expect(users.has(bookmark.userId)).toBe(true);
    expect(posts.has(bookmark.postId)).toBe(true);
  }
  for (const notification of state.notifications) {
    expect(users.has(notification.recipientId)).toBe(true);
    if (notification.actorId) expect(users.has(notification.actorId)).toBe(true);
    if (notification.topicId) expect(topics.has(notification.topicId)).toBe(true);
    if (notification.postId) expect(posts.has(notification.postId)).toBe(true);
  }
  for (const follow of state.follows) {
    expect(users.has(follow.followerId)).toBe(true);
    expect(users.has(follow.followeeId)).toBe(true);
  }
}

describe('分类与话题有效可见性（GitHub #272 / A3）', () => {
  it('游客和注册用户不收到成员分类元数据，成员、往届与版务仍能读取', async () => {
    const s = await setup();
    await s.category('c-exam', 'member');

    for (const who of PERSONAS) {
      const state = await s.state(who);
      expectReferences(state);
      expect(state.categories.map(category => category.id), who ?? 'guest').toEqual(
        who === undefined || who === 'registered' ? ['c-ai'] : ['c-ai', 'c-exam'],
      );
      if (who === undefined || who === 'registered') {
        expect(JSON.stringify(state)).not.toContain('夹具分类甲');
        expect(state.topics).toEqual([]);
        expect(state.posts).toEqual([]);
      }
    }
  });

  it('分类收紧不撤销历史显式public；关联保留原分类六字段DTO，不加入管理扩展', async () => {
    const s = await setup();
    expect((await s.call('PATCH', '/api/forum/topics/t73/visibility', 'moderator', { visibility: 'public' })).statusCode).toBe(200);
    await s.category('c-exam', 'member');

    for (const who of PERSONAS) {
      const state = await s.state(who);
      expectReferences(state);
      expect(state.topics.find(topic => topic.id === 't73')).toMatchObject({ visibility: 'public', categoryId: 'c-exam' });
      const category = state.categories.find(category => category.id === 'c-exam');
      expect(category).toEqual({
        id: 'c-exam', slug: 'exam', name: '夹具分类甲', description: '测试用分类', color: '#0f766e', icon: 'i-ri-file-list-3-line',
      });
      expect(Object.keys(category!).sort()).toEqual(['color', 'description', 'icon', 'id', 'name', 'slug']);
      if (who === undefined || who === 'registered') {
        expect(state.topics.map(topic => topic.id)).toEqual(['t73']);
        expect(state.posts.map(post => post.id)).toEqual(['body-73']);
      } else {
        expect(state.topics.map(topic => topic.id)).toEqual(['t9', 't73']);
      }
    }

    // 已受限的分类仍禁止新设更宽覆盖，不为修读投影放宽写合同。
    const tooOpen = await s.call('PATCH', '/api/forum/topics/t9/visibility', 'moderator', { visibility: 'public' });
    expect(tooOpen.statusCode).toBe(400);
    expect(tooOpen.json().error).toBe('visibility_too_open');
    expect((await s.call('PATCH', '/api/forum/topics/t73/visibility', 'moderator', { visibility: null })).statusCode).toBe(200);
    expect((await s.state()).categories.map(category => category.id)).toEqual(['c-ai']);
    expect((await s.state('member')).topics.find(topic => topic.id === 't73')).toMatchObject({ visibility: 'member' });
  });

  it('注册分类默认继承与更严话题override在state、搜索、分页和正文直链遵循同一读取等级', async () => {
    const s = await setup();
    await s.category('c-exam', 'registered');
    expect((await s.call('PATCH', '/api/forum/topics/t9/visibility', 'moderator', { visibility: 'member' })).statusCode).toBe(200);

    for (const who of PERSONAS) {
      const state = await s.state(who);
      expectReferences(state);
      const expected = who === undefined ? [] : who === 'registered' ? ['t73'] : ['t9', 't73'];
      expect(state.topics.map(topic => topic.id)).toEqual(expected);
      expect(state.categories.map(category => category.id)).toEqual(who === undefined ? ['c-ai'] : ['c-ai', 'c-exam']);
      const search = await s.call('GET', '/api/forum/search?q=夹具旧帖', who);
      expect(search.statusCode).toBe(200);
      expect(search.json().results.topics.map((topic: { id: string }) => topic.id).sort()).toEqual([...expected].sort());
      expect(search.json().results.posts.map((post: { topicId: string }) => post.topicId).sort()).toEqual([...expected].sort());
      const page = await s.call('GET', '/api/forum/topics?limit=1&q=夹具旧帖', who);
      expect(page.statusCode).toBe(200);
      const paged = [...page.json().topics];
      if (page.json().nextCursor) {
        const next = await s.call('GET', `/api/forum/topics?limit=1&q=夹具旧帖&cursor=${encodeURIComponent(page.json().nextCursor)}`, who);
        expect(next.statusCode).toBe(200);
        paged.push(...next.json().topics);
        expect(next.json().nextCursor).toBeNull();
      }
      expect(paged.map((topic: { id: string }) => topic.id).sort()).toEqual([...expected].sort());
      for (const [topicId, need] of [['t73', 'registered'], ['t9', 'member']] as const) {
        const response = await s.call('GET', `/api/forum/topics/${topicId}/posts`, who);
        if (expected.includes(topicId)) {
          expect(response.statusCode).toBe(200);
          expect(response.json().posts).toHaveLength(1);
          expect(response.json().posts[0].visibility).toBe(need);
        } else {
          expect(response.statusCode).toBe(who === undefined ? 401 : 403);
          expect(response.json().need).toBe(need);
          expect(response.body).not.toContain('夹具旧帖');
          expect(response.body).not.toContain('body-');
        }
      }
    }
    expect((await s.call('GET', '/api/forum/topics/t999999/posts')).statusCode).toBe(404);
    const consoleCategories = await s.call('GET', '/api/console/forum/categories', 'moderator');
    expect(consoleCategories.statusCode).toBe(200);
    expect(consoleCategories.json().categories).toEqual([
      { id: 'c-ai', name: '夹具分类乙', visibility: 'public', topic_count: 0 },
      { id: 'c-exam', name: '夹具分类甲', visibility: 'registered', topic_count: 2 },
    ]);
  });

  it('历史显式registered在分类后来收紧时保持优先，public分类的显式更严话题不泄漏', async () => {
    const s = await setup();
    expect((await s.call('PATCH', '/api/forum/topics/t73/visibility', 'moderator', { visibility: 'registered' })).statusCode).toBe(200);
    for (const scope of ['public', 'member'] as const) {
      await s.category('c-exam', scope);
      expect((await s.state()).topics).toEqual(scope === 'public' ? [expect.objectContaining({ id: 't9' })] : []);
      const registered = await s.state('registered');
      expectReferences(registered);
      expect(registered.topics.find(topic => topic.id === 't73')).toMatchObject({ visibility: 'registered' });
      expect(registered.categories.find(category => category.id === 'c-exam')).toMatchObject({ slug: 'exam', name: '夹具分类甲' });
      expect((await s.call('GET', '/api/forum/topics/t73/posts', 'registered')).statusCode).toBe(200);
    }
    expect((await s.call('PATCH', '/api/forum/topics/t73/visibility', 'moderator', { visibility: null })).statusCode).toBe(200);
    expect((await s.state('registered')).categories.map(category => category.id)).toEqual(['c-ai']);
    expect((await s.call('GET', '/api/forum/topics/t73/posts', 'registered')).json()).toMatchObject({ need: 'member', error: 'forbidden' });
  });

  it('受限话题的通知、书签、标签与关联引用一起隐藏，恢复分类后不删除历史记录', async () => {
    const s = await setup();
    const account = accountIdOf(s.app, 'visibility_registered');
    grantPermNode(s.app, account, 'forum.topic.create');
    grantPermNode(s.app, account, 'forum.react');
    const created = await s.call('POST', '/api/forum/topics', 'registered', {
      title: '分类收紧通知标题', categoryId: 'c-ai', content: '分类收紧通知正文', tags: ['通知保密标签'],
    });
    expect(created.statusCode).toBe(201);
    const { topicId, postId } = created.json() as { topicId: string; postId: string };
    expect((await s.call('POST', `/api/forum/posts/${postId}/bookmark`, 'registered')).statusCode).toBe(200);
    expect((await s.call('POST', '/api/forum/posts', 'member', { topicId, content: '分类收紧通知回复' })).statusCode).toBe(201);
    const before = await s.state('registered');
    expect(before.notifications).toHaveLength(1);
    expect(before.bookmarks).toHaveLength(1);
    expectReferences(before);
    await s.category('c-ai', 'member');
    const hidden = await s.state('registered');
    expectReferences(hidden);
    expect(hidden.notifications).toEqual([]);
    expect(hidden.bookmarks).toEqual([]);
    expect(JSON.stringify(hidden)).not.toContain('分类收紧通知');
    expect(JSON.stringify(hidden)).not.toContain('通知保密标签');
    expect(JSON.stringify(hidden)).not.toContain(topicId);
    await s.category('c-ai', 'public');
    const restored = await s.state('registered');
    expect(restored.notifications).toEqual(before.notifications);
    expect(restored.bookmarks).toEqual(before.bookmarks);
    expectReferences(restored);
  });

  it('分类收紧后，旧书签不能泄漏已不可见的帖子引用，恢复可见后书签仍在', async () => {
    const s = await setup();
    grantPermNode(s.app, accountIdOf(s.app, 'visibility_registered'), 'forum.react');
    const bookmark = await s.call('POST', '/api/forum/posts/body-73/bookmark', 'registered');
    expect(bookmark.statusCode).toBe(200);
    expect((await s.state('registered')).bookmarks).toEqual([
      expect.objectContaining({ postId: 'body-73' }),
    ]);

    await s.category('c-exam', 'member');
    const hidden = await s.state('registered');
    expect(hidden.bookmarks).toEqual([]);
    expect(JSON.stringify(hidden)).not.toContain('body-73');

    await s.category('c-exam', 'public');
    expect((await s.state('registered')).bookmarks).toEqual([
      expect.objectContaining({ postId: 'body-73' }),
    ]);
  });

  it('只用于隐藏话题的新标签不随state泄漏；公开精选标签与可见话题的标签保留', async () => {
    const s = await setup();
    const created = await s.call('POST', '/api/forum/topics', 'member', {
      title: '隐藏话题的标签', categoryId: 'c-ai', content: '标签的隔离正文', tags: ['仅隐藏话题的标签'],
    });
    expect(created.statusCode).toBe(201);
    const tagId = created.json().changes.tags[0].id as string;
    await s.category('c-ai', 'member');

    for (const who of PERSONAS) {
      const state = await s.state(who);
      const tagIds = state.tags.map(tag => tag.id);
      expect(tagIds).toEqual(expect.arrayContaining(['tag-grade25', 'tag-agents']));
      if (who === undefined || who === 'registered') {
        expect(tagIds).not.toContain(tagId);
        expect(JSON.stringify(state)).not.toContain('仅隐藏话题的标签');
      } else {
        expect(tagIds).toContain(tagId);
      }
    }
  });

  it('真实 /forum 文档出口按当前viewer实时生成，不读取构建时静态正文', async () => {
    const s = await setup();
    const publicIndex = await s.call('GET', '/forum/llms.txt');
    expect(publicIndex.statusCode).toBe(200);
    expect(publicIndex.headers['content-type']).toContain('text/plain');
    expect(publicIndex.headers['cache-control']).toContain('no-store');
    expect(publicIndex.body).toContain('[夹具旧帖一](https://example.test/forum/t/t73.md)');
    expect(publicIndex.body).toContain('[夹具旧帖二](https://example.test/forum/t/t9.md)');
    const publicIndexHead = await s.call('HEAD', '/forum/llms.txt');
    expect(publicIndexHead.statusCode).toBe(200);
    expect(publicIndexHead.headers['cache-control']).toContain('no-store');
    expect(publicIndexHead.body).toBe('');

    const publicTopic = await s.call('GET', '/forum/t/t73.md');
    expect(publicTopic.statusCode).toBe(200);
    expect(publicTopic.headers['content-type']).toContain('text/markdown');
    expect(publicTopic.headers['cache-control']).toContain('no-store');
    expect(publicTopic.body).toContain('title: "夹具旧帖一"');
    expect(publicTopic.body).toContain('# 夹具旧帖一');
    expect((await s.call('HEAD', '/forum/t/t73.md')).body).toBe('');

    await s.category('c-exam', 'member');
    const hiddenIndex = await s.call('GET', '/forum/llms.txt');
    expect(hiddenIndex.statusCode).toBe(200);
    expect(hiddenIndex.body).not.toContain('夹具旧帖一');
    expect(hiddenIndex.body).not.toContain('夹具旧帖二');
    const hiddenTopic = await s.call('GET', '/forum/t/t73.md');
    expect(hiddenTopic.statusCode).toBe(401);
    expect(hiddenTopic.json()).toMatchObject({ error: 'unauthenticated', need: 'member' });
    expect(hiddenTopic.body).not.toContain('夹具旧帖一');

    const memberIndex = await s.call('GET', '/forum/llms.txt', 'member');
    expect(memberIndex.body).toContain('[夹具旧帖一](https://example.test/forum/t/t73.md)');
    expect((await s.call('GET', '/forum/t/t73.md', 'member')).body).toContain('# 夹具旧帖一');
  });

  it('继承收紧、显式public例外、registered与未知id在 /forum 文档出口保留COALESCE语义', async () => {
    const s = await setup();
    expect((await s.call('PATCH', '/api/forum/topics/t73/visibility', 'moderator', { visibility: 'public' })).statusCode).toBe(200);
    await s.category('c-exam', 'member');

    const guestIndex = await s.call('GET', '/forum/llms.txt');
    expect(guestIndex.body).toContain('夹具旧帖一');
    expect(guestIndex.body).not.toContain('[夹具旧帖二](');
    expect(guestIndex.body).not.toContain('夹具旧帖二的正文');
    expect((await s.call('GET', '/forum/t/t73.md')).statusCode).toBe(200);
    expect((await s.call('GET', '/forum/t/t9.md')).json()).toMatchObject({ error: 'unauthenticated', need: 'member' });

    await s.category('c-exam', 'registered');
    expect((await s.call('PATCH', '/api/forum/topics/t73/visibility', 'moderator', { visibility: 'registered' })).statusCode).toBe(200);
    expect((await s.call('GET', '/forum/t/t73.md')).json()).toMatchObject({ error: 'unauthenticated', need: 'registered' });
    expect((await s.call('GET', '/forum/t/t73.md', 'registered')).statusCode).toBe(200);

    const missing = await s.call('GET', '/forum/t/t999999.md', 'member');
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({ error: 'not_found' });
    expect(missing.body).not.toContain('夹具旧帖');
  });

  it('published图片只有被当前viewer可见话题引用时才能下载，且不进入共享缓存', async () => {
    const s = await setup();
    s.app.services.storage.db.prepare("UPDATE forum_posts SET content = content || ? WHERE id = 'body-73'")
      .run('\n\n![夹具图](../published/aaaaaaaaaaaaaaaa.webp)');

    const publicImage = await s.call('GET', '/forum/published/aaaaaaaaaaaaaaaa.webp');
    expect(publicImage.statusCode).toBe(200);
    expect(publicImage.headers['content-type']).toContain('image/webp');
    expect(publicImage.headers['cache-control']).toContain('no-store');
    expect(publicImage.rawPayload.toString()).toBe('fixture-published-image\n');
    const publicImageHead = await s.call('HEAD', '/forum/published/aaaaaaaaaaaaaaaa.webp');
    expect(publicImageHead.statusCode).toBe(200);
    expect(publicImageHead.headers['cache-control']).toContain('no-store');
    expect(publicImageHead.body).toBe('');

    await s.category('c-exam', 'member');
    const hidden = await s.call('GET', '/forum/published/aaaaaaaaaaaaaaaa.webp');
    expect(hidden.statusCode).toBe(404);
    expect(hidden.rawPayload.toString()).not.toContain('fixture-published-image');
    expect((await s.call('GET', '/forum/published/aaaaaaaaaaaaaaaa.webp', 'member')).statusCode).toBe(200);
    expect((await s.call('GET', '/forum/published/bbbbbbbbbbbbbbbb.webp', 'member')).statusCode).toBe(404);
  });
});
