# Timeline 时间线

> 按时间顺序展示事件的列表

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/timeline) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/timeline.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/timeline.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
`color` 设置节点的语义色。
官方示例：`TimelineTimelineDemo`（完整源码见本页末尾）

```vue
<template>
  <TxTimeline>
    <TxTimelineItem title="设计阶段" time="09:30" color="primary" />
    <TxTimelineItem title="开发构建" time="12:00" color="success" />
    <TxTimelineItem title="上线发布" time="16:10" color="warning" />
  </TxTimeline>
</template>
```

### 后台审计流程
权限编排面板中，时间线记录授权步骤，`active` 标出当前步骤。
官方示例：`ComponentsPermissionOrchestrationDemo`（完整源码见本页末尾）

```vue
<template>
  <TxTimeline>
    <TxTimelineItem title="选择权限域" time="09:30" color="primary">
      release
    </TxTimelineItem>
    <TxTimelineItem title="分配资源" time="10:20" color="success" active>
      docs + notes
    </TxTimelineItem>
    <TxTimelineItem title="等待复核" time="11:05" color="warning">
      security review
    </TxTimelineItem>
  </TxTimeline>
</template>
```

### 最佳实践

- 状态写进 `title` 或默认插槽，`color` 只作视觉辅助。
- 步骤流里只把一个当前事件标为 `active`。
- 短里程碑序列用 `layout="horizontal"`；审计日志和长历史保持纵向。
- `time` 保持简短，同一条时间线内格式一致。
- 密集的时间线只给异常或关键状态加 `icon`。

## API 参考

### TxTimeline

#### 属性
```yaml
rows:
  - name: layout
    type: "'vertical' | 'horizontal'"
    default: "'vertical'"
    description: 布局方向，同步到所有子项。
```

#### 插槽

| 插槽 | 参数 | 说明 |
|------|------|------|
| `default` | - | 时间线条目。 |

### TxTimelineItem

#### 属性
```yaml
rows:
  - name: title
    type: string
    default: '-'
    description: 条目标题。
  - name: time
    type: string
    default: '-'
    description: 时间文本。
  - name: color
    type: "'default' | 'primary' | 'success' | 'warning' | 'error'"
    default: "'default'"
    description: 节点的语义色。
  - name: icon
    type: string
    default: '-'
    description: 节点图标。
  - name: active
    type: boolean
    default: 'false'
    description: 高亮当前事件的条目与节点。
```

#### 插槽

| 插槽 | 参数 | 说明 |
|------|------|------|
| `default` | - | 标题与时间下方的事件说明。 |

## 概述

- `TxTimeline` 为 `role="list"`，每个 `TxTimelineItem` 为 `role="listitem"`。
- `layout` 经 provide / inject 传给子项，子项无需各自设置。
- 节点圆点与图标带 `aria-hidden`，读屏只读到标题、时间与说明。

## 技术实现

- 源码：`packages/tuffex/packages/components/src/timeline/`。

## 离线完整示例源码

- [TimelineTimelineDemo](../snapshot/apps/nexus/app/components/content/demos/TimelineTimelineDemo.vue.txt)
- [ComponentsPermissionOrchestrationDemo](../snapshot/apps/nexus/app/components/content/demos/ComponentsPermissionOrchestrationDemo.vue.txt)

## 离线类型与实现参考

- [timeline/index.ts](../snapshot/packages/tuffex/packages/components/src/timeline/index.ts.txt)
- [src/TxTimeline.vue](../snapshot/packages/tuffex/packages/components/src/timeline/src/TxTimeline.vue.txt)
- [src/TxTimelineItem.vue](../snapshot/packages/tuffex/packages/components/src/timeline/src/TxTimelineItem.vue.txt)
- [src/index.ts](../snapshot/packages/tuffex/packages/components/src/timeline/src/index.ts.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/timeline/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
