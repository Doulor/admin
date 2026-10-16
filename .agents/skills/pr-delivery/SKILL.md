---
name: pr-delivery
description: "按 geek_main 规范准备或补全 PR 材料，核对正文、标签、验证、审查记录及合并后收尾。"
---

# PR 材料与交付

遵循根 [AGENTS](../../../AGENTS.md) 与 [PULL-REQUESTS](../../../docs/conventions/PULL-REQUESTS.md)，按当前任务执行以下步骤。

## 读取任务

按 [TRACKING §4](../../../docs/conventions/TRACKING.md) 读取 issue、PR 及最近追踪记录，核对来源分支、目标 stage 和完整 SHA：

```bash
gh issue view NUMBER --repo OWNER/REPO --json number,title,state,body,comments,labels
gh pr view PR_NUMBER --repo OWNER/REPO --json number,body,baseRefName,headRefName,headRefOid,labels,state,url
```

尚未创建 PR 时使用本地 task 分支与 `git rev-parse HEAD`。

## 整理正文与证据

按 [COMMITS](../../../docs/conventions/COMMITS.md) 写标题，使用当前 [PR 模板](../../../.github/pull_request_template.md) 填写九段正文。解决链路对应实际改动，验证结果与人工验收步骤对应 issue 的验收条件。

标签与分类证据按 PULL-REQUESTS「正文契约」及 [ISSUES §2](../../../docs/conventions/ISSUES.md) 核对：ui 提供改前改后截图，func 提供接口测试与接口验证，infra 提供命令与输出。执行验证按 [TESTING](../../../docs/conventions/TESTING.md)；使用 CI 报告或 PR 预览时查 [CICD](../../../docs/ops/CICD.md) 对应章节。

## 契约检查与审查

正文保存为 `/tmp/geek-pr-body.md`，读取 issue 状态和 PR 标签后运行现有检查：

```bash
gh issue view NUMBER --repo OWNER/REPO --json number,state,title,labels > /tmp/geek-pr-issue.json
gh pr view PR_NUMBER --repo OWNER/REPO --json labels --jq '.labels' > /tmp/geek-pr-labels.json
node scripts/pr-contract.mjs check --branch task/NUMBER/slug --body-file /tmp/geek-pr-body.md --issue-state-file /tmp/geek-pr-issue.json --labels-file /tmp/geek-pr-labels.json
```

草稿阶段的 labels 文件填写拟设置的标签数组；创建后按实际标签检查。创建或更新 PR 正文使用 `--body-file`。

diff 审查使用 [code-review](../code-review/SKILL.md)，结论按 [CODE-REVIEW](../../../docs/conventions/CODE-REVIEW.md) 写入 PR；执行记录按 [NOTES](../../../docs/conventions/NOTES.md) 补齐。

## 交付与收尾

交付 PR 链接或正文草稿、对应 SHA、验证与审查结果。合并后按 CODE-REVIEW 第 12 项和 TRACKING §1 核对 issue、分支与 worktree 的清理。
