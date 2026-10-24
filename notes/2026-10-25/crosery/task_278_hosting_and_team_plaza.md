# task/278/hosting_and_team_plaza · crosery · 2026-10-25

负责人：crosery

## 00:04:55 +08:00 · 返工 · #278 · 更正迁移演练记录，第一期改回个人赛

- 执行者：agent-claude-sonnet-host278（Claude Code 子 agent，claude-sonnet-5-5）
- 做了什么：data-model.md 与 278.json 把组队广场迁移演练的记录改成实情（/tmp 复制 .tools/yugc-v2/db/preview-copy-278.db 验证，原件未动，55 张表行数前后一致），之前写的「没有找到预发布库副本、改用内存库」「54 张表」都是假的，更正掉；另外所有者 23:38 更正第一期开源贡献赛不是团队赛——db.ts 的种子改成个人赛（participation=individual，team_min/team_max 留空），并加一段幂等修复：已经按团队赛种过但还没人报名/组队的库（预发布库副本核对过是这种情况）启动时自动改回个人赛，真的有人报名/组队就不动、留给组织者手工处理；contest-site.mjs 的 dev 示例、_starter 模板、quickstart 文档本来就默认个人赛，不用改
- 结果：server 793+3 测试全过（含改掉的 competition-scores.test.ts 一处旧断言），typecheck/check:secrets/check:docs/check:doc-sync/check:catalog/check:architecture 全绿；oss-2026-1 官网的真实 HTML/文案（队伍 tab、FAQ 一人一队说法）还是按团队赛写的，没有读 getTeams().enabled，这部分留给主 session 做 UI
- 下一步：主 session 接手时按「个人赛、不组队」改 oss-2026-1 官网文案与队伍 tab 的显隐
