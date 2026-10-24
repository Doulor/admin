import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { request } from "undici";
import type { Octokit } from "@octokit/rest";
import type { AppConfig } from "./config.js";
import { createDatabase } from "./lib/db.js";
import { createCrypto } from "./lib/crypto.js";
import { createAuth } from "./lib/auth.js";
import { createIdentityStore } from "./lib/identity-store.js";
import { createEmailLogin } from "./lib/email-login.js";
import { createInviteCodeStore } from "./lib/invite-codes.js";
import { createGoogle } from "./lib/google.js";
import { createDeviceStore } from "./lib/device-store.js";
import { createGithub } from "./lib/github-http.js";
import { createCache } from "./lib/cache.js";
import { createRoleStore } from "./lib/role-store.js";
import { createPermissionEngine } from "./lib/permissions.js";
import { createLimits } from "./lib/limits.js";
import { createAccountProfiles } from "./lib/account-profiles.js";
import { createActivityRecorder } from "./lib/activity.js";
import { createAccess } from "./lib/access.js";
import { createFeedbackStore } from "./lib/feedback-store.js";
import { createCompetitionStore } from "./lib/competition-store.js";
import { createCompetitionSignupStore } from "./lib/competition-signup-store.js";
import { createCompetitionScoreStore } from "./lib/competition-score-store.js";
import { createCompetitionRulesStore } from "./lib/competition-rules-store.js";
import { createCompetitionSiteStore } from "./lib/competition-site-store.js";
import { createCompetitionPublic, publicCachePrefix } from "./lib/competition-public.js";
import { createCompetitionPrizes } from "./lib/competition-prizes.js";
import { createCompetitionCandidates } from "./lib/competition-candidates.js";
import { loadForumContent } from "./lib/forum-content.js";
import { createForumStore } from "./lib/forum-store.js";
import { createMailer } from "./lib/mail/mailer.js";
import { createOidcStore } from "./lib/oidc-store.js";
import { createOidcProvider } from "./lib/oidc-provider.js";
import { createAccountDirectory } from "./lib/account-directory.js";
import { createGitlabSync, type FetchLike as GitlabFetch } from "./lib/gitlab-sync.js";
import type { FetchLike } from "./lib/mail/providers.js";
import { createPublicSubmission } from "./middleware/pow.js";
import { createTurnstile } from "./middleware/turnstile.js";

/**
 * `mailFetch`、`clock`：测试换掉发信商的 HTTP 请求，以及发信队列与会话清理用的时钟，都不连真实时间。
 * `octokitFactory`：测试换掉 GitHub API 客户端；#274 review round 1 删了 lib/github-connection.ts 与
 * `/api/join/:token`（GitHub 组织邀请链接，CONTRACT-274 §8）之后，服务端自己不再用它发真实请求，但保留这个
 * 覆盖点不动——大量既有测试的 `testApp({ octokitFactory })` 调用还在，不属于本轮复核的范围。
 * `gitlabFetch`、`githubProfileFetch`：测试换掉 GitLab 管理接口与建号时读 GitHub 公开资料、头像的请求（lib/gitlab-sync.ts）。
 */
export type ServiceOverrides = {
  httpRequest?: typeof request; octokitFactory?: (token: string) => Octokit; mailFetch?: FetchLike;
  gitlabFetch?: GitlabFetch; githubProfileFetch?: GitlabFetch; clock?: () => number;
};
/** Composition root. Only this module owns dependencies and database lifetimes. */
export function createServices(config: AppConfig, overrides: ServiceOverrides = {}) {
  const crypto = createCrypto(config.encryptionKey);
  const storage = createDatabase(config.dbPath, config.stickerAssetsDir);
  // #274 review round 1：lib/github-connection.ts（控制台接 GitHub App 管理组织）删掉了，github 服务现在
  // 没有生产代码读它；保留这个工厂只是因为 ServiceOverrides.octokitFactory 还有一批既有测试在用，见上面的注释。
  const github = createGithub(overrides.octokitFactory);
  const cache = createCache();
  const roles = createRoleStore(storage.db);
  // #274 迁移步骤 4（lib/migrations/2026-10-yugc-v2.ts 的 archiveOldDepartments()）仍然没有在这里调用，
  // 原因换了：原来挡在前面的「旧 requireCapability 写接口」已经随这次 Scope B 的路由删除（见执行记录）
  // 消失，但 GET /api/public/org（routes/portal/org.ts）读 `roles.listDepartments().filter(d => !d.archived)`。
  // 官网的组织架构窗口在 #275 改读 /api/public/departments，论坛的称号徽章（app/forum/app/composables/useOrgTitles.ts）
  // 还在读 /api/public/org，这时把四个默认部门标成已归档，论坛上的部门会当场消失。
  // 归档要等论坛也切走、确认 /api/public/org 没有活的前端读者之后再做。
  const auth = createAuth(storage.db, crypto, config, overrides.httpRequest, overrides.clock);
  // #274 SPEC §3.8：防盗刷计数唯一入口；提到 identity 前面建好，注册限额与邀请码猜测锁定
  // （signInWithGithub/signInSecondChannel，#274 review round 1）也要用它。
  const limits = createLimits(storage.db, { clock: overrides.clock });
  const identity = createIdentityStore(storage.db, { createSession: auth.createSession, audit: storage.audit, limits, clock: overrides.clock });
  const device = createDeviceStore(storage.db, { clock: overrides.clock });
  // 邮箱验证码、邀请码与 Google 登录（#262，所有者 2026-10-23）
  const emailLogin = createEmailLogin(storage.db, { sessionSecret: config.sessionSecret, clock: overrides.clock });
  const invites = createInviteCodeStore(storage.db, overrides.clock);
  const google = createGoogle(config.google, config.publicOrigin, overrides.httpRequest, overrides.clock);
  const feedback = createFeedbackStore(storage.db);
  const competitions = createCompetitionStore(storage.db);
  // 报名、组队与积分（#239）：认人用会话里的 account_id，表在 lib/db.ts 里随启动建好。
  const competitionSignups = createCompetitionSignupStore(storage.db, competitions);
  // 年级系数、奖项与 GitLab 项目（#278）：记分时按这里的系数加权，记下的分之后不再重算。
  const competitionRules = createCompetitionRulesStore(storage.db);
  const competitionScores = createCompetitionScoreStore(storage.db, competitions, competitionSignups, competitionRules);
  // 历史数据一次性归一（#129）：把 org 只是大小写不同的旧行改成 CONSOLE_ORG 的写法，重复启动安全。
  // 改不动就让启动失败，失败前先关掉刚打开的库，与下面论坛、发信的处理一致。
  try {
    feedback.normalizeOrgSpelling(config.consoleOrg);
  } catch (error) {
    storage.db.close();
    throw error;
  }
  // 论坛内容读不出来就让启动失败，不带着半份论坛上线；失败前先关掉刚打开的库。
  const forum = (() => {
    try {
      // 没打开过论坛的组织成员也不能被冒名：登录名取控制台的称号指派，加上登录过的人（审计里的 auth.signin 与当前会话）。
      const store = createForumStore(storage.db, loadForumContent(config.forumContentDir), {
        orgLogins: () => [...roles.listAssignments().map(row => row.github_login), ...auth.signedInLogins()],
      });
      store.seed();
      return store;
    } catch (error) {
      storage.db.close();
      throw error;
    }
  })();
  // 发信配置写错（地址格式、MAIL_ASSET_BASE）同样让启动失败；发信循环由 buildApp 的 mailWorker 决定开不开。
  const mail = (() => {
    try {
      return createMailer(storage.db, config.mail, config.publicOrigin, { fetch: overrides.mailFetch, now: overrides.clock });
    } catch (error) {
      storage.db.close();
      throw error;
    }
  })();
  const profiles = createAccountProfiles(storage.db, { clock: overrides.clock });
  // 对外授权与 GitLab 同步（#270，#274 改成读统一资料 account_profiles）：账号目录把账号和统一资料拼起来；
  // OIDC_JWKS 没设时不开 /oidc（oidc 为 null）。
  const oidcStore = createOidcStore(storage.db, crypto, overrides.clock);
  const directory = createAccountDirectory({ identity, profiles, publicOrigin: config.publicOrigin });
  const oidc = config.oidc
    ? { issuer: config.oidc.issuer, provider: createOidcProvider({ issuer: config.oidc.issuer, jwks: config.oidc.jwks, sessionSecret: config.sessionSecret, store: oidcStore, accounts: directory }) }
    : null;
  const gitlab = createGitlabSync(storage.db, {
    config: config.gitlab, directory, subjects: oidcStore, clients: oidcStore, avatars: profiles, audit: storage.audit,
    fetch: overrides.gitlabFetch, githubFetch: overrides.githubProfileFetch, clock: overrides.clock,
  });
  const permissions = createPermissionEngine(storage.db, overrides.clock);
  // 比赛官网托管（#278）：站点文件放在数据库旁边的 sites/（容器里是数据卷 /data/sites）；内存库（测试）用临时目录，关闭时删掉。
  const memorySites = config.dbPath === ":memory:" ? mkdtempSync(join(tmpdir(), "yzgc-sites-")) : null;
  const competitionSites = createCompetitionSiteStore(storage.db, { root: memorySites ?? resolve(dirname(config.dbPath), "sites"), secret: config.sessionSecret });
  const competitionPublic = createCompetitionPublic(storage.db, {
    competitions, signups: competitionSignups, scores: competitionScores, rules: competitionRules, sites: competitionSites,
  });
  const competitionPrizes = createCompetitionPrizes(storage.db, {
    competitions, scores: competitionScores, signupScoring: id => competitionSignups.settingsOf(id).scoring, rules: competitionRules, crypto,
  });
  // GitLab 贡献收集（#278）：复用 gitlab-sync 的令牌与请求函数，定时器由 buildApp 的 gitlabSync 决定开不开（和账号同步一起）。
  const competitionCandidates = createCompetitionCandidates(storage.db, {
    competitions, signups: competitionSignups, scores: competitionScores, rules: competitionRules, gitlab,
    canReview: accountId => permissions.check(accountId, "competition.score.review"),
    audit: storage.audit, onScoresChanged: id => cache.invalidate(publicCachePrefix(id)), clock: overrides.clock,
  });
  return {
    competitions,
    competitionSignups,
    competitionScores,
    competitionRules, competitionSites, competitionPublic, competitionPrizes, competitionCandidates,
    config, storage, crypto,
    auth,
    identity,
    emailLogin, invites, google,
    device,
    github, cache, roles,
    // #274 review round 1（blocker）：access.resolve 不再查 GitHub 组织角色，只传 membership.of；见 lib/access.ts。
    access: createAccess({ roles, membership: { of: identity.membershipOf } }),
    // #274 新权限引擎：和上面的 access（旧 capabilities）并存，中间件/路由逐步切过去，见 lib/permissions.ts。
    permissions,
    // 和别的服务用同一个可注入时钟：require-step-up.ts 判定「刚登录过」要用它比对 session.created_at
    // （由 auth.ts 的 createSession 用这同一个 clock 盖的时间戳），不能各用各的，测试拨慢/拨快时钟时才站得住。
    clock: overrides.clock ?? Date.now,
    profiles,
    // 操作记录唯一写入口（#274 SPEC §3.7）：lib/activity.ts 的 recordActivity，路由自己调用；清理定时器由 buildApp 的 activityCleanup 决定开不开。
    activity: createActivityRecorder(storage.db, overrides.clock),
    limits,
    feedback,
    forum,
    mail,
    oidcStore, directory, oidc, gitlab,
    publicSubmission: createPublicSubmission(config.powDifficulty),
    turnstile: createTurnstile(config, overrides.httpRequest),
    close() {
      void mail.stop(); void gitlab.stop(); void competitionCandidates.stop(); auth.stopCleanup(); storage.db.close();
      if (memorySites) rmSync(memorySites, { recursive: true, force: true });
    },
  };
}
export type AppServices = ReturnType<typeof createServices>;
declare module "fastify" { interface FastifyInstance { services: AppServices } }
