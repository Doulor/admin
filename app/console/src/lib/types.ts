// 控制台接口的前端类型。服务端 app/server/src/lib/roles.ts 是唯一来源；
// 控制台不能导入服务端实现，这里只声明 HTTP 形状，能力 id 与中文名以 /api/console/catalogue 为准。

export type Capability = string;
export type Tone = "amber" | "cobalt" | "violet" | "jade" | "sky" | "coral" | "rose" | "slate";
/** `admin` 是站内管理员，由站内角色自动获得、不能指派；`guest` 是没有任何称号。名字等显示信息见 catalogue。 */
export type TitleId = "admin" | "captain" | "head" | "member" | "alumni" | "guest";
/** GitHub 组织里的角色：只在「成员与权限」的名单里作参考，不决定任何权限。 */
export type GithubRole = "admin" | "member" | null;
/** 站内角色（#262 第四期，权限只认极客班账号）：管理员（提督）、成员（舰员）；null 是不是成员。 */
export type SiteRole = "admin" | "member" | null;
export type SiteRoleChoice = "admin" | "member" | "none";
/** 这次请求接 GitHub 的方式：服务器的 GitHub App、你这次 GitHub 登录的本人令牌，或还没接上。 */
export type GithubVia = "app" | "session" | "none";
/** 这次会话的登录方式（#262）。权限与登录方式无关，只看账号。 */
export type SessionProvider = "github" | "email" | "google";

export type DepartmentView = { id: string; name: string; tag: string; icon: string; tone: Tone };
export type TitleView = {
  id: TitleId; label: string; tag: string; icon: string; tone: Tone;
  department: DepartmentView | null;
  source: "assignment" | "site" | "none";
  assignment_id: number | null;
};

export type ConsoleMe = {
  login: string; avatar_url: string | null; org: string;
  provider: SessionProvider;
  site_role: SiteRole;
  github: GithubVia;
  title: TitleView; titles: TitleView[];
  capabilities: Capability[];
  head_of: string[];
};

export type CatalogueCapability = { id: Capability; domain: string; label: string; description: string };
export type CatalogueTitle = { id: TitleId; label: string; tag: string; icon: string; tone: Tone; rank: number; description: string };
export type Catalogue = {
  titles: CatalogueTitle[];
  crew: { tag: string; tone: Tone; rank: number };
  tones: Record<Tone, string>;
  capabilities: CatalogueCapability[];
  domains: { id: string; label: string }[];
  role_base: Record<TitleId, Capability[]>;
  implies?: Record<string, Capability[]>;
  captain_only: Capability[];
  department_icons: string[];
  application_statuses: { id: string; label: string }[];
};

export type Department = DepartmentView & {
  description: string; head_capabilities: Capability[]; member_capabilities: Capability[];
  sort_order: number; archived: boolean; heads: string[]; crew_count: number;
};

export type AssignableRole = Exclude<TitleId, "admin" | "guest">;
export type Assignment = {
  id: number; github_login: string; github_user_id: number | null; account_id: string | null;
  role: AssignableRole; department_id: string; note: string | null; granted_by: string; created_at: number;
};
export type AssignmentsResponse = { assignments: Assignment[]; captain: { github_login: string } | null };

/**
 * GET /api/console/people：每个极客班账号，接上 GitHub 时再加 GitHub 组织里还没登录过的人（account_id 为 null），
 * 最后是有称号但两边都没有的人。`github_role` 只在列出了 GitHub 组织成员时下发；`role_unrecorded` 是以前用 GitHub
 * 登录时建的老账号还没记过站内角色（下次用 GitHub 时按 GitHub 组织补记）。
 */
export type Person = {
  account_id: string | null; login: string; user_id: number | null; avatar_url: string | null;
  site_role: SiteRole; role_unrecorded: boolean; member: boolean; status: "active" | "disabled" | null;
  providers: SessionProvider[]; last_login_at: number | null;
  github_role?: GithubRole;
  titles: TitleView[];
};
export type PeopleResponse = { people: Person[]; github: GithubVia; github_listed: boolean };
export type SiteRoleResponse = { account_id: string; site_role: SiteRoleChoice; changed: boolean };

/** GitLab 账号同步（#270，GET /api/console/gitlab/accounts）：每个极客班账号在 GitLab 上的用户、状态和还要做的事。 */
export type GitlabMode = "off" | "dry-run" | "on";
export type GitlabAction =
  | { kind: "create"; username: string; access_level: number }
  | { kind: "block" | "unblock" | "find_and_block" | "set_avatar" }
  | { kind: "set_access"; access_level: number };
export type GitlabAccount = {
  account_id: string; login: string; username: string | null; gitlab_user_id: number | null;
  state: "pending" | "active" | "blocked" | null; access_level: number | null;
  last_error: string | null; last_error_at: number | null; synced_at: number | null; pending: GitlabAction[];
};
export type GitlabAccountsResponse = { mode: GitlabMode; gitlab_url: string | null; group: string; client_registered: boolean; accounts: GitlabAccount[] };
/** POST /api/console/gitlab/accounts/:account_id/sync：这一次做了什么、有没有出错。 */
export type GitlabSyncOutcome = { mode: GitlabMode; account_id: string; login: string; actions: GitlabAction[]; applied: boolean; error: string | null };

/** 称号在服务端存的样子；PATCH /api/console/titles/:title_id 只提交改动的字段，返回改后的整条。 */
export type TitleConfig = { id: TitleId; label: string; tag: string; icon: string; tone: Tone; description: string; capabilities: Capability[] };
export type TitlePatch = Partial<Omit<TitleConfig, "id">>;
export type TitlePatchResponse = { title: TitleConfig };

/** 当前投递状态；审核记录中的旧状态按字符串收，见 statuses.ts 的 statusMeta。 */
export type ApplicationStatus = "received" | "interview" | "accepted" | "rejected" | "cancelled";
export type ApplicationItem = {
  id: string; name: string; class_name: string; email: string; strengths_excerpt: string; status: ApplicationStatus; created_at: number;
  last_review: { to_status: string; reviewer: string; created_at: number } | null;
};
export type ApplicationList = { items: ApplicationItem[]; total: number; counts: Record<string, number> };

/** 一封信在发信队列里的状态；地址和正文发完就删，只留主题。 */
export type MailStatus = "pending" | "sending" | "sent" | "failed" | "skipped";
export type MailSummary = {
  status: MailStatus; skip_reason: string | null; attempts: number; subject: string; sent_at: number | null; updated_at: number;
};
/** deliverable：给这位投递人的信现在会不会真的发出去（发信已配置，且 recipients 是 all 或地址在白名单里）。 */
export type MailSettings = { enabled: boolean; recipients: "all" | "allowlist"; deliverable: boolean };

/** from_status / to_status 是历史：可能是已退役的 `reviewing`。mail 是这次改状态发的信，没发为 null。 */
export type ApplicationReview = {
  id: number; from_status: string; to_status: string; note: string | null; reviewer: string; created_at: number; mail: MailSummary | null;
};
export type ApplicationRecord = { id: string; name: string; class_name: string; email: string; strengths: string; status: ApplicationStatus; created_at: number };
export type ApplicationDetail = {
  application: ApplicationRecord;
  reviews: ApplicationReview[];
  /** 投递时自动发的「已收到」确认信。 */
  received_mail: MailSummary | null;
  mail: MailSettings;
};
/** 通知信里投递人能看到的内容；notes 与 message 一行一条。 */
export type ApplicationLetter = { time?: string; place?: string; notes?: string; message?: string };
/**
 * PATCH /api/console/applications/:id。note 只给审核人看，不进信；notify 默认 true。
 * expected_status、expected_review_id 是页面上看到的状态和审核记录的版本号（最大的审核记录 id，没有记录时是 0）；
 * 库里已经被别人处理过时服务端回 409 status_changed，不改也不发信。要改状态时两项都得带。
 */
export type ApplicationReviewPatch = {
  status?: ApplicationStatus; expected_status?: ApplicationStatus; expected_review_id?: number; note?: string; notify?: boolean; letter?: ApplicationLetter;
};
export type ApplicationReviewResult = { application: ApplicationRecord; review: ApplicationReview };

export type Summary = {
  applications?: { total: number; by_status: Record<string, number>; last_7d: number };
  feedback?: { open: number; total: number };
  people?: { assignments: number; departments: number };
};

export type FeedbackStatus = "open" | "triaged" | "in_progress" | "done" | "wont_do" | "spam";
export type FeedbackItem = {
  id: number; category: string | null; content: string; contact: string | null; submitter_login: string | null;
  status: FeedbackStatus; reply: string | null; replied_by: string | null; replied_at: number | null; created_at: number;
};
export type FeedbackList = { items: FeedbackItem[]; counts: Record<string, number> };

export type AuditRow = { id: number; actor: string; action: string; target: string | null; ip: string | null; details: unknown; created_at: number };

/** 比赛（#238）：状态由服务端按时间算好，控制台只负责显示。 */
export type CompetitionStatus = "upcoming" | "registering" | "closed" | "ongoing" | "ended";
export type CompetitionKind = "internal" | "external";
export type CompetitionRecord = {
  id: string; name: string; kind: CompetitionKind;
  start_at: number; end_at: number; signup_deadline: number | null;
  url: string | null; description: string; status: CompetitionStatus; offline: boolean;
};

/** 报名设置（#239）：没有设置行的比赛按默认值（未开放报名）。 */
export type SignupParticipation = "individual" | "team";
export type SignupScoring = "none" | "contribution";
export type SignupSettings = {
  enabled: boolean; participation: SignupParticipation; team_min: number; team_max: number; scoring: SignupScoring;
};

/** 名单统计：口径见服务端 `statsOf`（个人赛的确认人数等于报名人数，没有「未成队」）。 */
export type RosterStats = { signups: number; teams: number; locked_teams: number; confirmed_people: number; unplaced: number };
export type RosterPerson = { account_id: string; login: string; avatar_url: string | null };
/** 控制台名单里的报名：含已取消的历史行。 */
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

/** 积分账本：一条记录只改状态，撤销留痕。 */
export type ScoreKind = "issue" | "pr" | "penalty";
export type ScoreEvent = {
  id: string; competition_id: string; person: RosterPerson; kind: ScoreKind;
  repo: string | null; number: number | null; points: number; reason: string;
  status: "active" | "revoked"; created_by_login: string; created_at: number;
  revoked_at: number | null; revoke_reason: string | null;
};
export type ScoreEventList = { events: ScoreEvent[] };

/** 注册邀请码（GET /api/console/invites）：次数上限、过期时间为 null 表示不限；usable 是现在还能不能用。 */
export type InviteCode = {
  id: number; code: string; note: string; max_uses: number | null; used_count: number; expires_at: number | null;
  disabled: boolean; created_by: string; created_at: number; updated_at: number; usable: boolean;
};
export type InviteList = { invites: InviteCode[] };

/** 账号页（GET /api/identity/me）：登录方式、密码、成员资格、这次登录与最近的账号记录。邮箱只下发打码后的样子。 */
export type AccountIdentity = { provider: SessionProvider; label: string; linked_at: number; last_login_at: number | null };
export type AccountAction = "login" | "login_denied" | "logout" | "register" | "link" | "link_conflict" | "password_set" | "password_change" | "role_change";
export type AccountView = {
  account_id: string; login: string;
  identities: AccountIdentity[];
  has_password: boolean; password_updated_at: number | null;
  membership: { state: string; org_role: SiteRole; via_invite: boolean };
  created_at: number;
  recent: { at: number; action: AccountAction | string; provider: string | null; result: "ok" | "denied" | "failed" }[];
  available: "email"[];
  session: { provider: SessionProvider; created_at: number; expires_at: number; step_up_until: number };
};
