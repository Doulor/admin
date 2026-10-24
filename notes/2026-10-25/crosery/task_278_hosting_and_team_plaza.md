# task/278/hosting_and_team_plaza · crosery · 2026-10-25

负责人：crosery

## 00:04:55 +08:00 · 返工 · #278 · 更正迁移演练记录，第一期改回个人赛

- 执行者：agent-claude-sonnet-host278（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：data-model.md 与 278.json 把组队广场迁移演练的记录改成实情（/tmp 复制 .tools/yugc-v2/db/preview-copy-278.db 验证，原件未动，55 张表行数前后一致），之前写的「没有找到预发布库副本、改用内存库」「54 张表」都是假的，更正掉；另外所有者 23:38 更正第一期开源贡献赛不是团队赛——db.ts 的种子改成个人赛（participation=individual，team_min/team_max 留空），并加一段幂等修复：已经按团队赛种过但还没人报名/组队的库（预发布库副本核对过是这种情况）启动时自动改回个人赛，真的有人报名/组队就不动、留给组织者手工处理；contest-site.mjs 的 dev 示例、_starter 模板、quickstart 文档本来就默认个人赛，不用改
- 结果：server 793+3 测试全过（含改掉的 competition-scores.test.ts 一处旧断言），typecheck/check:secrets/check:docs/check:doc-sync/check:catalog/check:architecture 全绿；oss-2026-1 官网的真实 HTML/文案（队伍 tab、FAQ 一人一队说法）还是按团队赛写的，没有读 getTeams().enabled，这部分留给主 session 做 UI
- 下一步：主 session 接手时按「个人赛、不组队」改 oss-2026-1 官网文案与队伍 tab 的显隐

## 02:57:39 +08:00 · 提交 · #278 · 比赛新增规划中状态：迁移、状态规则、报名组队拒绝、控制台与门户类型同步

- 执行者：agent-claude-sonnet-host278（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：给 competitions 加 planning 列（幂等迁移，PRAGMA table_info 先查再加，默认 0）；competitionStatus 新增 planning 分支（打开且未到开赛时间才生效，过了开赛时间自动失效，照原规则走进行中/已结束）；writeFailure 统一拒绝路径新增 competition_planning 错误码（409），报名、取消报名、建队与队伍全部写操作在 planning 期间一律拒绝；控制台创建/更新契约新增可选 planning 字段，公开与控制台响应原样回传；控制台类型、mock 与门户 SDK/标签同步加 planning 以保持 TypeScript 编译通过，不建表单勾选控件（UI 由主会话负责）
- 结果：commit 7465394c；tsc --noEmit（server、web）与 vue-tsc --noEmit（console）全过；tests/server+console+web+tooling 共 2059 项，2056 通过、3 项失败且与本次改动无关（#280 补资料页跳转，核对过涉及文件 HEAD 与 stage 无差异）
- 下一步：主会话在控制台编辑表单补勾选 planning 的控件；下次有预发布库副本时补演练这一列迁移

## 02:58:07 +08:00 · 提交 · #278 · contest-site.mjs dev 新增 --api 本地对接线上公开接口

- 执行者：agent-claude-sonnet-host278（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：dev 子命令加 --api <https 源/127.0.0.1/localhost>：公开比赛只读接口转发到该源而非写死样例数据，只转发 GET/HEAD，剔除响应里的 Set-Cookie，不转发 cookie 或鉴权头，非法源拒绝、上游不可达回 502；_starter/vite.config.ts 的代理目标改读 CONTEST_API 环境变量，默认值不变
- 结果：commit bf650554；tests/tooling 共 36 个文件 803 项全过
- 下一步：无
