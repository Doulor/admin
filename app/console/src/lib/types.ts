// 控制台接口的前端类型。HTTP 形状以 .tools/handoff/2026-10-23-yugc-os-v2/CONTRACT-274.md 为准，
// 控制台不能导入服务端实现，这里只手写一份声明。

export type Permission = string;
/** 部门色调（SPEC §1）：AI=y、算法=u、硬件=c、网安=g、管理=pill，无部门=ink。 */
export type DeptTone = "y" | "u" | "c" | "g" | "pill" | "ink";
/** 状态标签的色调（ToneTag.vue），和部门色调是两套独立的取值。 */
export type Tone = "amber" | "cobalt" | "violet" | "jade" | "sky" | "coral" | "rose" | "slate";

/** 这次会话的登录方式；权限只看账号，登录方式只决定这次能借用哪种本人授权。 */
export type SessionProvider = "github" | "email" | "google";
/** 四种身份，按 访客 → 注册用户 → 成员 依次升级；往届成员是成员的平行分支。 */
export type Level = "visitor" | "registered" | "member" | "alumni";

export type DepartmentRef = { id: string; name: string; tone: DeptTone };
export type TitleRef = { id: string; name: string; department_id: string | null };

/** GET /api/console/me：控制台会话身份；permissions 是这个账号在控制台用得到的全部具体节点。 */
export type ConsoleMe = {
  account_id: string; login: string; username: string; display_name: string; avatar_url: string | null;
  level: Level; level_name: string;
  department: DepartmentRef | null;
  titles: TitleRef[];
  permissions: Permission[];
  provider: SessionProvider;
  email_required: boolean;
};

/** GET /api/public/departments：公开的部门列表，顺序固定为 AI、算法、硬件、网安、管理、无部门。 */
export type PublicDepartment = {
  id: string; name: string; tone: DeptTone; icon: string; description: string;
  titles: { id: string; name: string; weight: number }[];
};
export type PublicDepartmentsResponse = { departments: PublicDepartment[] };

// ---- 用户（GET /api/console/users、PATCH /api/console/users/:id） ----

export type GitlabSyncState = "synced" | "pending" | "failed" | "blocked" | "none";
export type UserStatus = "active" | "disabled";
export type ConsoleUser = {
  account_id: string; username: string; display_name: string; avatar_url: string | null; status: UserStatus;
  level: Level; department: DepartmentRef | null; titles: TitleRef[]; providers: SessionProvider[];
  gitlab: { state: GitlabSyncState; gitlab_user_id: number | null };
  last_login_at: number | null; created_at: number;
};
export type UsersCounts = { visitor_today: number; registered: number; member: number; alumni: number };
export type UsersResponse = { items: ConsoleUser[]; next_cursor: string | null; counts: UsersCounts };
export type UserPatch = Partial<{ status: UserStatus; level: Level; department: string | null; titles: string[] }>;

// ---- 权限（节点、组、解释） ----

export type PermissionNodeDef = { node: Permission; domain: string; label: string; description: string; meta: boolean };
export type PermissionDomain = { id: string; label: string };
export type PermissionNodesResponse = { nodes: PermissionNodeDef[]; domains: PermissionDomain[] };

export type PermissionScope = Record<string, unknown>;
export type PermissionGroupKind = "level" | "department" | "title" | "custom";
export type PermissionEntry = {
  id: number; node: Permission; value: boolean | null; meta_value: string | null; scope: PermissionScope; expires_at: number | null;
};
export type PermissionGroup = {
  id: string; kind: PermissionGroupKind; name: string; description: string; weight: number;
  department_id: string | null; icon: string; tone: DeptTone; sort: number; system: boolean;
  parents: string[]; member_count: number; entries: PermissionEntry[];
};
export type PermissionGroupsResponse = { groups: PermissionGroup[] };
/** GET /api/console/permission-groups/:id/members：组里的账号（CONTRACT §5，10-24 00:10 补）。 */
export type PermissionGroupMember = {
  account_id: string; username: string; display_name: string; avatar_url: string | null;
  expires_at: number | null; granted_by: string | null; created_at: number;
};
export type PermissionGroupMembersResponse = { members: PermissionGroupMember[] };
/** POST /api/console/permission-groups 的请求体。 */
export type PermissionGroupCreate = { id: string; name: string; description?: string; weight: number; parents?: string[]; icon?: string; tone?: DeptTone };
/** PATCH /api/console/permission-groups/:id 的请求体；entries 只带增删。 */
export type PermissionEntryInput = { node: Permission; value?: boolean; meta_value?: string; scope?: PermissionScope; expires_at?: number | null };
export type PermissionGroupPatch = Partial<{
  name: string; description: string; weight: number; parents: string[]; icon: string; tone: DeptTone; sort: number;
  entries: { add: PermissionEntryInput[]; remove: number[] };
}>;

export type PermissionExplainResult = "allow" | "deny" | "unset";
export type PermissionExplainHit = {
  source: "account" | "group"; group: { id: string; name: string } | null; via: string[];
  entry: { node: Permission; value: boolean | null; scope: PermissionScope; expires_at: number | null };
};
export type PermissionExplain = { node: Permission; result: PermissionExplainResult; hits: PermissionExplainHit[]; meta_value?: string };
export type EffectivePermissions = {
  account_id: string; groups: { id: string; name: string; kind: PermissionGroupKind; via: string[] }[];
  allow: Permission[]; deny: Permission[]; meta: Record<string, string>;
};

// ---- 操作记录 ----

export type ActivitySurface = "portal" | "forum" | "console" | "cli" | "api" | "system";
export type ActivityOutcome = "ok" | "denied" | "limited" | "error";
export type ActivityAccountRef = { id: string; username: string; display_name: string; avatar_url: string | null };
export type ActivityEvent = {
  id: number; at: number; account: ActivityAccountRef | null; visitor_id: string | null;
  surface: ActivitySurface; action: string; target_type: string | null; target_id: string | null;
  outcome: ActivityOutcome; ip: string | null; ua: string | null; request_id: string | null; meta: Record<string, unknown>;
};
export type ActivityBlockedBucket = { bucket: string; count: number };
export type ActivityList = { items: ActivityEvent[]; next_cursor: string | null; blocked_today: ActivityBlockedBucket[] };

// ---- GitLab ----

export type GitlabSyncMode = "off" | "dry-run" | "on";
export type GitlabStatus = {
  mode: GitlabSyncMode; url: string | null; group: string; token_configured: boolean; version: string | null;
  healthy: boolean; last_run: { at: number; changed: number; failed: number } | null; errors_24h: number;
};
export type GitlabProjectGroup = { id: number; full_path: string; name: string; visibility: string };
export type GitlabProject = {
  id: number; path_with_namespace: string; name: string; description: string | null; visibility: string;
  web_url: string; http_url_to_repo: string; ssh_url_to_repo: string; last_activity_at: number | null; star_count: number;
};
export type GitlabProjectsResponse = { groups: GitlabProjectGroup[]; projects: GitlabProject[] };
export type GitlabSettings = { sync_mode: GitlabSyncMode; group_path: string; interval_minutes: number; token_configured: boolean };

/** GitLab 账号同步（#270，沿用原形状，GET /api/console/gitlab/accounts）。 */
export type GitlabAction =
  | { kind: "create"; username: string; access_level: number }
  | { kind: "block" | "unblock" | "find_and_block" | "set_avatar" | "set_emails" }
  | { kind: "set_access"; access_level: number };
export type GitlabAccount = {
  account_id: string; login: string; username: string | null; gitlab_user_id: number | null;
  state: "pending" | "active" | "blocked" | null; access_level: number | null;
  last_error: string | null; last_error_at: number | null; synced_at: number | null; pending: GitlabAction[];
};
export type GitlabAccountsResponse = { mode: GitlabSyncMode; gitlab_url: string | null; group: string; client_registered: boolean; accounts: GitlabAccount[] };
export type GitlabSyncOutcome = { mode: GitlabSyncMode; account_id: string; login: string; actions: GitlabAction[]; applied: boolean; error: string | null };

// ---- 概览 ----

export type Summary = {
  applications?: { total: number; by_status: Record<string, number>; last_7d: number };
  candidates_pending?: number;
  registrations_today?: number;
  blocked_today?: number;
  gitlab?: { mode: GitlabSyncMode; healthy: boolean; last_run: { at: number; changed: number; failed: number } | null };
  feedback?: { open: number; total: number };
};

// ---- 投递（#148，不受本次权限改版影响） ----

export type ApplicationStatus = "received" | "interview" | "accepted" | "rejected" | "cancelled";
export type ApplicationItem = {
  id: string; name: string; class_name: string; email: string; strengths_excerpt: string; status: ApplicationStatus; created_at: number;
  last_review: { to_status: string; reviewer: string; created_at: number } | null;
};
export type ApplicationList = { items: ApplicationItem[]; total: number; counts: Record<string, number> };

export type MailStatus = "pending" | "sending" | "sent" | "failed" | "skipped";
export type MailSummary = {
  status: MailStatus; skip_reason: string | null; attempts: number; subject: string; sent_at: number | null; updated_at: number;
};
export type MailSettings = { enabled: boolean; recipients: "all" | "allowlist"; deliverable: boolean };

export type ApplicationReview = {
  id: number; from_status: string; to_status: string; note: string | null; reviewer: string; created_at: number; mail: MailSummary | null;
};
export type ApplicationRecord = { id: string; name: string; class_name: string; email: string; strengths: string; status: ApplicationStatus; created_at: number };
export type ApplicationDetail = {
  application: ApplicationRecord;
  reviews: ApplicationReview[];
  received_mail: MailSummary | null;
  mail: MailSettings;
};
export type ApplicationLetter = { time?: string; place?: string; notes?: string; message?: string };
export type ApplicationReviewPatch = {
  status?: ApplicationStatus; expected_status?: ApplicationStatus; expected_review_id?: number; note?: string; notify?: boolean; letter?: ApplicationLetter;
};
export type ApplicationReviewResult = { application: ApplicationRecord; review: ApplicationReview };

// ---- 意见箱 ----

export type FeedbackStatus = "open" | "triaged" | "in_progress" | "done" | "wont_do" | "spam";
export type FeedbackItem = {
  id: number; category: string | null; content: string; contact: string | null; submitter_login: string | null;
  status: FeedbackStatus; reply: string | null; replied_by: string | null; replied_at: number | null; created_at: number;
};
export type FeedbackList = { items: FeedbackItem[]; counts: Record<string, number> };

// ---- 比赛（#238/#239，不受本次权限改版影响） ----

export type CompetitionStatus = "upcoming" | "registering" | "closed" | "ongoing" | "ended";
export type CompetitionKind = "internal" | "external";
export type CompetitionRecord = {
  id: string; name: string; kind: CompetitionKind;
  start_at: number; end_at: number; signup_deadline: number | null;
  url: string | null; description: string; status: CompetitionStatus; offline: boolean;
};

export type SignupParticipation = "individual" | "team";
export type SignupScoring = "none" | "contribution";
export type SignupSettings = {
  enabled: boolean; participation: SignupParticipation; team_min: number; team_max: number; scoring: SignupScoring;
};

export type RosterStats = { signups: number; teams: number; locked_teams: number; confirmed_people: number; unplaced: number };
export type RosterPerson = { account_id: string; login: string; avatar_url: string | null };
export type RosterSignup = RosterPerson & {
  status: "active" | "cancelled"; note: string; looking_for_team: boolean;
  team_id: string | null; team_name: string | null; role: "leader" | "member" | null;
  created_at: number; updated_at: number; cancelled_at: number | null;
};
export type RosterTeamMember = RosterPerson & { role: "leader" | "member"; joined_at: number };
export type RosterTeam = {
  id: string; name: string; slogan: string; status: "recruiting" | "locked" | "disbanded";
  leader_account_id: string; members: RosterTeamMember[]; member_count: number;
  created_at: number; disbanded_at: number | null;
};
export type CompetitionRoster = { settings: SignupSettings; stats: RosterStats; signups: RosterSignup[]; teams: RosterTeam[] };

export type ScoreKind = "issue" | "pr" | "penalty";
export type ScoreEvent = {
  id: string; competition_id: string; person: RosterPerson; kind: ScoreKind;
  repo: string | null; number: number | null; points: number; reason: string;
  status: "active" | "revoked"; created_by_login: string; created_at: number;
  revoked_at: number | null; revoke_reason: string | null;
};
export type ScoreEventList = { events: ScoreEvent[] };

// ---- 注册邀请码（节点改为 invite.manage，形状不变） ----

export type InviteCode = {
  id: number; code: string; note: string; max_uses: number | null; used_count: number; expires_at: number | null;
  disabled: boolean; created_by: string; created_at: number; updated_at: number; usable: boolean;
};
export type InviteList = { invites: InviteCode[] };

// ---- 账号页 /account（#262/#270/#272/#273，身份域，独立于控制台权限改版） ----

/** 账号页用的站内角色；只用于 /api/identity/me 的成员资格展示，和控制台的 Level/权限节点是两套概念。 */
export type SiteRole = "admin" | "member" | null;
export type AccountIdentity = { provider: SessionProvider; label: string; linked_at: number; last_login_at: number | null; id?: string; primary?: boolean };
export type AccountAction = "login" | "login_denied" | "logout" | "register" | "link" | "link_conflict" | "unlink" | "password_set" | "password_change" | "password_reset" | "role_change";
export type AccountView = {
  account_id: string; login: string;
  identities: AccountIdentity[];
  has_password: boolean; password_updated_at: number | null;
  membership: { state: string; org_role: SiteRole; via_invite: boolean };
  created_at: number;
  recent: { at: number; action: AccountAction | string; provider: string | null; result: "ok" | "denied" | "failed" }[];
  available: "email"[];
  email_required: boolean;
  session: { provider: SessionProvider; created_at: number; expires_at: number; step_up_until: number };
};
