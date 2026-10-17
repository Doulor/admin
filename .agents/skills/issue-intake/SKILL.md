---
name: issue-intake
description: "提 issue、建单、补全或接手 issue 之前先用：查重、标签、证据缺口。用户说「提个 issue」「帮我建单」「issue 被 needs-evidence 拦了」，或你准备执行 gh issue create 时调用。"
---

# 提 issue 的经验

规则在 [ISSUES](../../../docs/conventions/ISSUES.md)，这里只记规则里没写的做法。

1. 先搜再写。关键词取模块名加症状原文，开放和已关闭的都搜：`gh issue list --state all --search '<关键词>'`。做完的标志：正文「相关 issue」段写出搜过的两个关键词和命中的 `#n`，或「无相关」。搜到同一件事就补到原单；已取消（not planned）的先问人。
2. 标签随建单一起给，每个标签一个 `--label`。口径看 ISSUES §2 的「组:类」表；`gh issue create` 没有表单，漏了标签会被 `issue-gate` 加 `needs-evidence`，`task.mjs start` 拒绝开工。
3. 证据缺什么就写缺什么。`ui:*` 没有截图时，「截图证明」段写「待补：现状截图」，并在交给人的说明里列出；段里不放图片语法、占位链接或假文件名。这样提交的 issue 会被 `issue-gate` 标上 `needs-evidence`，`task.mjs start` 在截图补上之前拒绝开工。`func:*` 写「涉及接口」：方法加路径、要补的接口测试，没有接口变化写「无接口变更：<理由>」。
4. 正文写现象和期望，方案留到「方案」追踪记录。验收条件写成别人照着做、能看到结果的步骤。
5. 一个 issue 只放能一起验收的事；拆开的几个互相 `Refs #n`。

交付：正文、标签、查重结果、缺的证据，以及需要人确认的事。执行 `gh issue create` 之前，等人确认这一步。之后的开工与 PR 见 [pr-delivery](../pr-delivery/SKILL.md)。
