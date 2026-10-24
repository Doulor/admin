# task/278/contest_site · crosery · 2026-10-24

负责人：crosery

## 14:04:50 +08:00 · 开工 · #278 · 接手 #278 第一期比赛官网、托管、SDK、GitLab 贡献计分、奖励与兑奖码

- 执行者：agent-claude-geek-main-3c2a7a67-c278（Claude Code 子 agent，claude-opus-5-5）
- 做了什么：主会话已从 stage e43df562 建好 task/278/contest_site 与 .claude/worktrees/task-278（含 #280 的 1bd64d6d：grade.ts 与 account_profiles 两列）；读完 AGENTS.md 第 0 节规范、COMMITS、TESTING、交接目录的 SPEC §7、CONTRACT-278、DESIGN-278、CONTRACT-274 通用约定、ACCEPTANCE F 节，以及现有比赛、GitLab 同步、权限、限额、操作记录代码
- 结果：git branch --show-current = task/278/contest_site，工作区干净，HEAD 1bd64d6d
- 下一步：先写服务端：托管与站点包校验、公开接口与缓存限流、贡献收集与有用标签核实、年级系数、奖项、定榜与兑奖码

## 14:30:32 +08:00 · 方案 · #278 · 服务端方案定稿：托管、公开接口、贡献收集、年级系数、定榜与兑奖码

- 执行者：agent-claude-geek-main-3c2a7a67-c278（Claude Code 子 agent，claude-opus-5-5）
- 做了什么：按 CONTRACT-278 与所有者 10-24 13:45 的规则定下替所有者做的决定：积分记录加 grade/grade_factor/weighted_points 三列（百分数，不重建 CHECK），扣分不乘系数；标签被拿掉时只撤销经标签自动加的分、候选回待确认，控制台确认的不动，定榜后都不改；作者自己打的「有用」不算；定榜名次严格不并列（同分先到者在前，再按报名先后），只发给分数大于 0 的个人；兑奖码 YUGC-XXXX-XXXX-XXXX-XXXX（80 位随机），库里存 SHA-256、AES-GCM 密文和末四位；新节点 competition.prize.redeem（已被 competition.* 与 * 覆盖，不改种子台账）；公开接口缓存 10 秒、按 IP 每分钟 120 次，另加整份快照接口给 SDK 轮询；预览用一小时有效的签名路径段，因为 sandbox 页面的子资源请求不带 cookie；站点文件放在数据库旁的 sites/，不加新环境变量
- 结果：lib/ 新增 site-package、competition-site-store、competition-rules-store、competition-public、competition-candidates、competition-prizes；server tsc 通过，现有服务端测试除两处表与种子清单外全过，两处按新增的表与种子补上
- 下一步：写服务端测试：托管与预览、公开接口不漏字段与限流、标签核实、年级系数、定榜、兑奖

## 14:44:10 +08:00 · 开发 · #278 · 服务端：官网托管、公开接口、贡献收集、年级系数、定榜与兑奖

- 执行者：agent-claude-geek-main-3c2a7a67-c278（Claude Code 子 agent，claude-opus-5-5）
- 做了什么：新增 7 张表与 3 个积分列；site-package 校验站点包；/c/:slug 同域托管加 sandbox CSP 与签名预览；公开天梯、动态、统计、快照接口按 IP 限流并缓存 10 秒；GitLab 收集合并的 MR 与 Issue 并核实「有用」标签；年级系数按记分时刻落库；定榜生成兑奖码，控制台查找与核销；新节点 competition.prize.redeem；同步 server README、endpoint-contracts、data-model、API、SECURITY
- 结果：npx tsc -p app/server/tsconfig.json --noEmit 无错误；npx vitest run tests/server 35 个文件 602 个测试全部通过（新增 competition-site/public/candidates/prizes 四组 25 个）
- 下一步：提交服务端；再做 SDK、打包脚本、nginx、官网、门户与控制台
