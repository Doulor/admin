---
name: issue-intake
description: "按 geek_main 规范准备、补全或接手 issue，完成查重、正文、标签和证据整理。"
---

# Issue 提单

遵循根 [AGENTS](../../../AGENTS.md) 与 [ISSUES](../../../docs/conventions/ISSUES.md)，按当前任务执行以下步骤。

## 查重与接手

搜索开放和已关闭的 issue，再读取相关候选：

```bash
gh issue list --repo OWNER/REPO --state all --search '关键词' --limit 50 --json number,title,state,url
gh issue view NUMBER --repo OWNER/REPO --json number,title,state,stateReason,body,comments,labels
```

按 ISSUES §2「相关 issue」决定补充原单、拆分或续作，在正文写出关键词、编号与关系。接手任务时按 [TRACKING §4](../../../docs/conventions/TRACKING.md) 读取最近追踪记录和关联 PR。

## 整理正文

使用当前 [issue 表单](../../../.github/ISSUE_TEMPLATE)，按 ISSUES §2–§3 填写标题、缺陷或需求字段、环境及验收条件。

按改动类型准备证明：ui 对应现状截图，func 对应涉及接口与测试计划，infra 对应命令与输出；具体标签、证据内容、图片上传及生效范围取自 ISSUES §2。查重结果写入「相关 issue」，实施方案写入「方案」追踪记录。

## 提单与交接

正文保存为文件，CLI 建单使用 `gh issue create --repo OWNER/REPO --title '标题' --body-file 正文文件`，每个所选标签添加一个 `--label`。

进展评论与正文「实施」段按 TRACKING 维护；进入开发时按 [BRANCHING](../../../docs/conventions/BRANCHING.md) 和 [NOTES](../../../docs/conventions/NOTES.md) 建立 worktree 与执行记录。准备 PR 使用 [pr-delivery](../pr-delivery/SKILL.md)。

交付 issue 链接或正文草稿，以及当前进展。
