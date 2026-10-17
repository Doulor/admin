---
name: pr-delivery
description: "准备或补全 PR 正文、开 PR、被 CI 拦住、合并后收尾之前先用。用户说「开 PR」「写 PR 正文」「pr-contract 失败」「branch-guard 红了」「合并后收尾」，或你准备执行 gh pr create 时调用。"
---

# 开 PR 与收尾的经验

规则在 [PULL-REQUESTS](../../../docs/conventions/PULL-REQUESTS.md)、[CODE-REVIEW](../../../docs/conventions/CODE-REVIEW.md)、[NOTES](../../../docs/conventions/NOTES.md)，这里只记规则里没写的做法。

1. 按 `.github/pull_request_template.md` 的九段把正文写到文件。
2. 用真实检查器跑自己的草稿，按报错改正文，再跑：`node scripts/pr-contract.mjs check --branch <task 分支> --body-file <正文> --issue-state-file <issue 的 json> --labels-file <拟设标签的 json>`。做完的标志：报错只剩你确实没有的证据，例如截图。
3. 缺的证据原样写「未提供」或「未验证」加原因，例如论坛检查缺 Node ≥26。证据段里不放图片语法、占位链接或假文件名；没跑的命令不写成通过。
4. 「审查结论」段写 `**结论：通过**`、`**结论：有条件通过**` 或 `**结论：阻塞**` 其中一行，加审查人和被审查的完整 SHA；作者自查也这样写。
5. `func:*` 的「验证命令与结果」要有接口测试命令、真实输出，以及对真实接口的请求；没做就写「未验证」。
6. 开 PR 后补一条 `note.mjs add --stage PR` 并 `docs(notes): …` 提交推送。第一次开 PR 后 `branch-guard` 变红是预期：它要链路里已有「PR」记录。「审查」记录同理，审查结论出来再补。
7. CI 红了，先对照 `origin/stage` 判断是不是这个 PR 引入的：在临时 worktree 合成合并提交，跑同一条检查。`stage` 本来就红的，在 PR 里写明。
8. 来自 fork 的 PR 合并后，`issue-lifecycle` 没有写权限，issue 不会自动关；合并的人当场手工关并留「关闭」记录。合并后等两个工作流跑完再核对清理，`task.mjs finish` 之后才能推别的分支。

交付：PR 正文、标签、检查器的最终输出、缺的证据，以及需要人确认的事。执行 `gh pr create` 之前，等人确认这一步。
