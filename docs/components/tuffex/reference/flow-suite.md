# 流程套件

> 工作流编排：点阵画布上的节点、分支与连线

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/flow-suite) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/flow-suite.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/flow-suite.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.6.0`，syncStatus=`reviewed`，verified=`false`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

每个格子都是可交互的真实组件，点击左上角名称进入对应组件文档。

此处为官网动态目录/交互图库；离线组件与审阅状态见 [组件索引](../COMPONENTS.md)。

## 概述

流程套件负责把一串操作画成一张可读、可改的图。**Flowchart** 是这套能力的画布：点阵背景、绝对定位的节点、随卡片实测高度重算的贝塞尔连线，以及可选的拖拽与栅格吸附。它刻意只管画布、连线和分类胶囊三件事——卡片里是什么由宿主通过插槽给，所以同一块画布既可以画自动化规则，也可以画 agent 的工具调用链或一次部署流水线。运行时经 `@talex-touch/tuffex/ai` 入口引入：套件是**文档层**的划分，组件桶仍是 base / pro / ai 三分。

## 离线完整示例源码

此页没有引用独立 Demo；正文中的代码块保持原样。

## 离线类型与实现参考

本页是跨组件/概念说明；先按具体组件查询 catalog.json，再按 SOURCE 清单核对；不要从名称猜导出。

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
