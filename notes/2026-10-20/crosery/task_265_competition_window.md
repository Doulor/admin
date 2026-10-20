# task/265/competition_window · crosery · 2026-10-20

负责人：crosery

## 12:10:02 +08:00 · 开工 · #265 · 从 origin/stage b51bf137626f 建 task/265/competition_window

- 执行者：agent-notion-geek（Notion AI，经 wanctl 操作公司 Mac）
- 做了什么：node scripts/task.mjs start 265 competition_window：建分支与 worktree .claude/worktrees/task-265，在 issue 上留开工记录
- 结果：worktree 已建好，issue 上已留开工记录

## 17:01:10 +08:00 · 开发 · #265 · 比赛窗口改成列表加详情：筛选、搜索、赛程与手机进出详情

- 执行者：agent-notion-geek（Notion AI，经 wanctl 操作公司 Mac）
- 做了什么：按 docs/plan/COMPETITION-APP.md「结构与呈现」重做浏览部分：新增 components/os/competitions/（CompetitionsApp、CompetitionList、CompetitionDetail）与 lib/competitionLabels.ts；Windows.tsx 改挂新组件、宽 1100，手机标题栏返回键可由窗口换成「比赛列表」（PhoneNav），带 data-no-autofocus 的输入框不抢焦点；lib/competitions.ts 加 reload 与同一屏共用的当前时间；os.css 换成 .pt-cx* 样式（矮屏窗口高度给 Dock 留出空隙）；mock-api.ts 的 demoCompetitions 换成七场五种状态的样板；单测重写为 24 条，新增 e2e tests/e2e/portal-competitions.spec.ts；portal 合同、比赛应用方案、ownership.json 与 docs/changes/265.json 同步，pnpm catalog:generate 重建 6 个生成文件
- 结果：pnpm check 退出 0（宏观对齐 #265，22 个变更文件，17 个关联节点）；e2e portal-competitions 2 条通过；portal-phone 18 条中 16 条按默认超时通过，:77 的 360×780、390×844 两条本机 20 秒内 3D 场景没加载完，E2E_TIMEOUT_SCALE=3 重跑 :77 三条通过；临时脚本查 1024×768、1280×720、1366×768、1440×900、1920×1080 与 820×1180、768×1024 都没有横向滚动，桌面窗口底边离 Dock 至少 9 像素；改前（预发布 rc.6 换同一份样板）与改后截图各拍桌面 1440×900、手机 390×844，存在 Crosery 的 gist

## 17:01:10 +08:00 · 提交 · #265 · 提交比赛窗口重做与回归测试

- 执行者：agent-notion-geek（Notion AI，经 wanctl 操作公司 Mac）
- 做了什么：提交组件、文案纯函数、数据钩子、窗口外壳、样式、开发样板、单元与 e2e 测试、portal 合同、比赛应用方案、ownership.json 与 6 个项目目录生成文件、docs/changes/265.json 与本执行记录；#263 的收尾记录另一个提交
- 结果：待 pre-push 与 CI 复核
- 下一步：推到主仓库同名分支，开 PR 回 stage，CI 全绿后以 merge commit 合并并关闭 #265
