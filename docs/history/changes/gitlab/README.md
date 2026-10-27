# GitLab 历史影响声明

> 保存跨仓同号 issue 的原始声明；本目录不是当前 GitHub 任务的实施依据。

状态：`historical` · 更新：2026-10-27 · 来源：真实 GitLab `stage`，提交 `02cb751c0b830c0e686a180f6c6c5870c0c055ec`。

## 276

`276.json` 逐字归档上述提交的 `docs/changes/276.json`（论坛回复框、表情和控制台表情管理，历史 GitLab #276）。当前 GitHub #276 是首场内部个人赛演练，两者不是同一事项。归档先于更新当前声明；不改写历史 notes。

- 原路径：`docs/changes/276.json`
- 原 Git blob：`38e23269bb8689c4772c5214dbdcdba8f227efde`
- 归档路径：`docs/history/changes/gitlab/276.json`

复核：

```sh
git rev-parse 02cb751c0b830c0e686a180f6c6c5870c0c055ec:docs/changes/276.json
git hash-object docs/history/changes/gitlab/276.json
git show 02cb751c0b830c0e686a180f6c6c5870c0c055ec:docs/changes/276.json | cmp - docs/history/changes/gitlab/276.json
```

两次 blob 输出须一致，`cmp` 须退出 0。本目录保留历史原文，不能拿其旧业务范围作为本次比赛变更的覆盖声明。
