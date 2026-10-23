import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app/server/src/app';
import { createConfig } from '../../app/server/src/config';
import type { ServiceOverrides } from '../../app/server/src/services';

/** 论坛内容夹具（分类、标签、两篇旧帖），代替 app/forum/content 的真实文件。 */
export const FORUM_FIXTURE_DIR = fileURLToPath(new URL('./fixtures/forum-content', import.meta.url));

/** createConfig 之后把论坛内容目录换成夹具：测试不读真实的论坛内容。 */
export function testConfig(env: Record<string, string | undefined>) {
  return { ...createConfig(env), forumContentDir: FORUM_FIXTURE_DIR };
}

/** Core-only fixture. A missing/deprecated FORUM_DB_PATH must never be opened. `env` 覆盖个别环境变量（例如 TRUST_PROXY）。 */
export async function testApp(overrides: ServiceOverrides = {}, production = false, env: Record<string, string> = {}) {
  const config = testConfig({
    NODE_ENV: production ? 'production' : 'test',
    PUBLIC_ORIGIN: 'https://example.test', DB_PATH: ':memory:',
    FORUM_DB_PATH: '/nonexistent/never-open-legacy-forum.db',
    SESSION_SECRET: 'isolated-core-test-secret-at-least-32',
    ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
    OAUTH_CLIENT_ID: 'test-client', OAUTH_CLIENT_SECRET: 'test-only-placeholder', POW_DIFFICULTY: '0',
    ...env,
  });
  const deny = () => { throw new Error('Unexpected external network request in isolated core test'); };
  // 发信商的请求同样默认拒绝：要发信的用例自己注入 mailFetch
  const app = await buildApp({ config, staticRoot: false, overrides: { httpRequest: deny as unknown as ServiceOverrides['httpRequest'], octokitFactory: deny, mailFetch: deny as unknown as ServiceOverrides['mailFetch'], ...overrides } });
  await app.ready();
  return { app, close: () => app.close() };
}

/**
 * 测试里签一个 GitHub 会话（#262；#274 不再查组织，邀请码选填）：走真实的登录事务（找到或建立极客班账号、
 * 认领、写会话和审计），代替原来直接调 auth.createSession(login, userId, avatarUrl, token)。会话从此都带账号，
 * 没有 GitHub id 的会话按未登录处理。不传邀请码：新建的测试账号进 level.registered（signInWithGithub 现在
 * 不论有没有邀请码都会调用 syncPermissionLevel，不会出现「perm_members 里什么分组都没有，requirePermission
 * 一律 403」的情况）。
 */
export function signIn(app: FastifyInstance, login: string, githubId: number, avatarUrl: string | null = null, accessToken = `token-${login}`): string {
  if (!Number.isInteger(githubId)) throw new Error(`test sign-in needs a GitHub id for ${login}`);
  const result = app.services.identity.signInWithGithub({ github: { id: githubId, login, avatarUrl }, accessToken });
  if (!result.ok) throw new Error(`test sign-in refused for ${login}: ${result.reason}`);
  return result.sid;
}

/**
 * #274 新权限体系的账号 id：按登录名查 `sessions` 表（signIn() 已经写过）。requirePermission 系的路由
 * 测试不再靠「GitHub 组织角色桩」间接认出管理员——那一套只喂给旧 requireCapability 背后的动态查询，
 * 新系统完全是静态存储，测试要显式把账号放进对应的组（见下面 grantPermGroup）。
 */
export function accountIdOf(app: FastifyInstance, login: string): string {
  return (app.services.storage.db.prepare('SELECT openid FROM sessions WHERE login = ?').get(login) as { openid: string }).openid;
}

/** 把账号放进一个权限组（level、department、title 或 custom 组），例如 grantPermGroup(app, accountId, 'title.site.owner') 让它变成站长。 */
export function grantPermGroup(app: FastifyInstance, accountId: string, groupId: string): void {
  app.services.storage.db.prepare(
    "INSERT OR IGNORE INTO perm_members(account_id, group_id, granted_by, created_at) VALUES (?, ?, 'test', ?)",
  ).run(accountId, groupId, Date.now());
  app.services.permissions.bump();
}

/** 给账号的 perm_entries 直接加一条允许条目（可选 scope），不经过任何组。 */
export function grantPermNode(app: FastifyInstance, accountId: string, node: string, scope: Record<string, unknown> = {}): void {
  app.services.storage.db.prepare(
    "INSERT INTO perm_entries(subject_type, subject_id, node, value, scope, granted_by, created_at) VALUES ('account', ?, ?, 1, ?, 'test', ?)",
  ).run(accountId, node, JSON.stringify(scope), Date.now());
  app.services.permissions.bump();
}
