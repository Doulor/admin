# GroupBlock 分组块

> 承载设置行的可折叠分组

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/group-block) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/group-block.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/group-block.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
`TxGroupBlock` 承载一组设置行，点击头部展开或折叠。
官方示例：`GroupBlockGroupBlockDemo`（完整源码见本页末尾）

```vue
<template>
  <TxGroupBlock name="通用设置" description="配置基本选项" default-icon="i-carbon-settings">
    <TxBlockSwitch
      v-model="notifications"
      title="通知"
      description="启用推送通知"
      default-icon="i-carbon-notification"
      active-icon="i-carbon-notification-filled"
    />
    <TxBlockSlot title="语言" description="选择显示语言" default-icon="i-carbon-translate">
      <TxSelect v-model="language" placeholder="选择语言">
        <TuffSelectItem value="en" label="English" />
        <TuffSelectItem value="zh" label="中文" />
      </TxSelect>
    </TxBlockSlot>
    <TxBlockLine title="版本" description="2.4.13-beta.3" />
  </TxGroupBlock>
</template>
```

### 初始折叠
`:default-expand="false"` 让分组首屏折叠。
官方示例：`GroupBlockGroupBlockCollapsedDemo`（完整源码见本页末尾）

```vue
<template>
  <TxGroupBlock
    name="高级设置"
    default-icon="i-carbon-folder"
    active-icon="i-carbon-folder-open"
    :default-expand="false"
  >
    <TxBlockLine title="展示内容" description="高级内容已保持挂载" />
  </TxGroupBlock>
</template>
```

### 记忆展开状态
设置 `memory-name` 后，展开状态在刷新后保留。
官方示例：`GroupBlockGroupBlockMemoryDemo`（完整源码见本页末尾）

```vue
<template>
  <TxGroupBlock name="更新策略" description="记忆展开状态" memory-name="tx-group-block-demo">
    <TxBlockSwitch v-model="autoUpdate" title="自动更新" description="后台自动检查更新" />
  </TxGroupBlock>
</template>
```

### 头部操作
`header-extra` 插槽位于折叠箭头之前。
官方示例：`GroupBlockGroupBlockHeaderExtraDemo`（完整源码见本页末尾）

```vue
<template>
  <TxGroupBlock name="同步" description="手动触发同步" :collapsible="false">
    <template #header-extra>
      <TxButton size="sm" variant="secondary">立即同步</TxButton>
    </template>
    <TxBlockLine title="上次同步" description="刚刚" />
  </TxGroupBlock>
</template>
```

### 只读行
`TxBlockLine` 并排显示标题与值，放不下时值换到标题下方。
官方示例：`GroupBlockBlockLineBasicDemo`（完整源码见本页末尾）

```vue
<template>
  <TxBlockLine title="版本" description="2.4.13-beta.3" />
  <TxBlockLine title="构建日期" description="2026.07.06" />
  <TxBlockLine title="如何安装？" description="pnpm add @talex-touch/tuffex" />
</template>
```

### 链接行
`link` 把行渲染为按钮并派发 `click`，内容放进 `description` 插槽。
官方示例：`GroupBlockBlockLineLinkDemo`（完整源码见本页末尾）

```vue
<template>
  <TxBlockLine title="查看文档" link @click="openDocs">
    <template #description>
      打开开发者文档
      <span class="i-carbon-arrow-up-right" aria-hidden="true" />
    </template>
  </TxBlockLine>
</template>
```

### 自定义控件
`TxBlockSlot` 的默认插槽放置任意控件。
官方示例：`GroupBlockBlockSlotDemo`（完整源码见本页末尾）

```vue
<template>
  <TxBlockSlot title="主题" description="选择您偏好的主题" default-icon="i-carbon-color-palette">
    <TxSelect v-model="theme" placeholder="选择主题">
      <TuffSelectItem value="light" label="浅色" />
      <TuffSelectItem value="dark" label="深色" />
      <TuffSelectItem value="auto" label="跟随系统" />
    </TxSelect>
  </TxBlockSlot>
</template>
```

### 激活态与标签
`active` 切换到 `activeIcon`，`tags` 插槽显示在标题旁。
官方示例：`GroupBlockBlockSlotActiveDemo`（完整源码见本页末尾）

```vue
<template>
  <TxBlockSlot
    title="置顶工作区"
    description="优先显示该工作区"
    default-icon="i-carbon-star"
    active-icon="i-carbon-star-filled"
    active
  >
    <template #tags>
      <TxTag label="已启用" icon="i-carbon-checkmark-filled" color="var(--tx-color-success)" />
    </template>
    <TxButton size="sm" variant="secondary">管理</TxButton>
  </TxBlockSlot>
</template>
```

### 自定义标签
`label` 插槽替换标题与描述。
官方示例：`GroupBlockBlockSlotCustomLabelDemo`（完整源码见本页末尾）

```vue
<template>
  <TxBlockSlot default-icon="i-carbon-user-profile">
    <template #label>
      <strong>资料名称</strong>
      <p>显示在共享工作区。</p>
    </template>
    <TuffInput v-model="profileName" placeholder="输入资料名称" />
  </TxBlockSlot>
</template>
```

### 输入行
`TxBlockInput` 是内置 `TxInput` 的设置行。
官方示例：`GroupBlockBlockInputDemo`（完整源码见本页末尾）

```vue
<template>
  <TxBlockInput
    v-model="displayName"
    title="显示名称"
    description="用于协作空间和通知。"
    placeholder="输入显示名称"
    default-icon="i-carbon-user-profile"
    clearable
  />
</template>
```

### 选择行
`TxBlockSelect` 是内置 `TxSelect` 的设置行，选项放进默认插槽。
官方示例：`GroupBlockBlockSelectDemo`（完整源码见本页末尾）

```vue
<template>
  <TxBlockSelect
    v-model="timezone"
    title="时间显示"
    description="选择活动时间的展示方式。"
    placeholder="选择时间显示"
    default-icon="i-carbon-time"
  >
    <TuffSelectItem value="local" label="本地时间" />
    <TuffSelectItem value="utc" label="UTC" />
    <TuffSelectItem value="relative" label="相对时间" />
  </TxBlockSelect>
</template>
```

### 开关行
官方示例：`GroupBlockBlockSwitchDemo`（完整源码见本页末尾）

```vue
<template>
  <TxBlockSwitch
    v-model="autoUpdate"
    title="自动更新"
    description="后台自动检查并下载更新"
    default-icon="i-carbon-renew"
  />
</template>
```

### 开关加载中
`loading` 让内部开关的滑块变为旋转环，整行冻结但不压暗。
官方示例：`GroupBlockBlockSwitchLoadingDemo`（完整源码见本页末尾）

```vue
<template>
  <TxBlockSwitch
    v-model="syncEnabled"
    title="正在同步"
    description="等待最新状态返回"
    default-icon="i-carbon-renew"
    loading
  />
</template>
```

### 开关禁用
官方示例：`GroupBlockBlockSwitchDisabledDemo`（完整源码见本页末尾）

```vue
<template>
  <TxBlockSwitch
    v-model="locked"
    title="高级功能"
    description="需要订阅或管理员授权"
    default-icon="i-carbon-locked"
    disabled
  />
</template>
```

### 引导行
`guidance` 以箭头替代开关，只派发 `click`。
官方示例：`GroupBlockBlockSwitchGuidanceDemo`（完整源码见本页末尾）

```vue
<template>
  <TxBlockSwitch
    v-model="dummy"
    title="隐私设置"
    description="管理设备、数据和授权选项"
    default-icon="i-carbon-security"
    guidance
    @click="openPrivacy"
  />
</template>
```

### 最佳实践

- `memoryName` 保持唯一且稳定，不要在无关分组间复用。
- 始终可见的状态或表单段落设 `collapsible=false`，避免暗示存在隐藏内容。
- 只读值与轻量跳转用 `TxBlockLine`，自定义控件用 `TxBlockSlot`，标准表单行用 `TxBlockInput` / `TxBlockSelect`，布尔值与导航用 `TxBlockSwitch`。
- 行标题保持简短，长说明放进描述，不要在行内嵌套复杂布局。
- 组内行的直角由分组负责；不要在行上写 `border-radius: 0` 模仿这种外观。

## API 参考

### TxGroupBlock

#### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|-------------|
| `name` | `string` | *必填* | 分组标题。 |
| `description` | `string` | `''` | 标题下方的说明。 |
| `defaultIcon` | `TxIconSource \| string` | - | 折叠时的图标，也是 `activeIcon` 的回退。 |
| `activeIcon` | `TxIconSource \| string` | - | 展开时的图标；未设置时用 `defaultIcon`。 |
| `iconSize` | `number` | `22` | 头部图标尺寸（px）。 |
| `collapsible` | `boolean` | `true` | 允许点击头部展开或折叠。 |
| `collapsed` | `boolean` | `false` | 外部折叠状态，在用户切换或有持久化值之前随变化生效。 |
| `defaultExpand` | `boolean` | - | 首屏展开状态，优先于 `collapsed`；未设置时取 `!collapsed`。 |
| `memoryName` | `string` | `''` | 以 `tuff-block-storage-` 为前缀把展开状态存入 `localStorage`。 |

#### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `update:expanded` | `expanded: boolean` | 用户切换展开状态后触发。 |
| `toggle` | `expanded: boolean` | 与 `update:expanded` 同时触发。 |

#### 插槽

| 插槽名 | 参数 | 说明 |
|------|------|------|
| `default` | - | 分组内的行。 |
| `icon` | `{ active: boolean }` | 自定义头部图标。 |
| `header-extra` | `{ active: boolean }` | 头部操作区，位于折叠箭头之前。 |

### TxBlockLine

#### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|-------------|
| `title` | `string` | `''` | 行标题。 |
| `description` | `string` | `''` | 非链接行的值，可被 `description` 插槽替换。 |
| `link` | `boolean` | `false` | 渲染为带链接样式的原生按钮，并派发 `click`。 |

#### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `click` | `event: MouseEvent` | 仅 `link` 时触发。 |

#### 插槽

| 插槽名 | 参数 | 说明 |
|------|------|------|
| `description` | - | 自定义值或链接内容。 |

### TxBlockSlot

#### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|-------------|
| `title` | `string` | `''` | 标题；有 `label` 插槽时不渲染。 |
| `description` | `string` | `''` | 描述；有 `label` 插槽时不渲染。 |
| `defaultIcon` | `TxIconSource \| string` | - | 非激活时的图标，也是 `activeIcon` 的回退。 |
| `activeIcon` | `TxIconSource \| string` | - | 激活时的图标；未设置时用 `defaultIcon`。 |
| `iconSize` | `number` | `20` | 图标尺寸（px）。 |
| `active` | `boolean` | `false` | 切换到 `activeIcon` 并传入插槽作用域，不改变行样式。 |
| `disabled` | `boolean` | `false` | 禁用样式，阻止 `click`。 |

#### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `click` | `event: MouseEvent` | 点击行时触发；绑定后行可聚焦，也响应 Enter / Space。 |

#### 插槽

| 插槽名 | 参数 | 说明 |
|------|------|------|
| `default` | `{ active: boolean }` | 右侧控件区。 |
| `icon` | `{ active: boolean }` | 自定义图标。 |
| `label` | - | 替换标题与描述。 |
| `tags` | - | 标题旁（或自定义标签下方）的元信息。 |

### TxBlockInput

#### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|-------------|
| `modelValue` | `string \| number` | `''` | 输入值，配合 `v-model`。 |
| `title` | `string` | `''` | 行标题。 |
| `description` | `string` | `''` | 行描述。 |
| `defaultIcon` | `TxIconSource \| string` | - | 未聚焦时的图标，也是 `activeIcon` 的回退。 |
| `activeIcon` | `TxIconSource \| string` | - | 聚焦时的图标。 |
| `disabled` | `boolean` | `false` | 禁用行与输入框。 |
| `placeholder` | `string` | `''` | 占位文本。 |
| `clearable` | `boolean` | `false` | 透传给 `TxInput`。 |
| `inputType` | `'text' \| 'password' \| 'number' \| 'email'` | `'text'` | 透传为 `TxInput` 的类型。 |

#### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `update:modelValue` | `value: string \| number` | 输入值变化时触发。 |
| `input` | `value: string \| number` | 透传 `TxInput` 的 `input`。 |
| `focus` | `event: FocusEvent` | 输入框聚焦时触发。 |
| `blur` | `event: FocusEvent` | 输入框失焦时触发。 |

#### 插槽

| 插槽名 | 参数 | 说明 |
|------|------|------|
| `control` | `{ value: string \| number, focused: boolean }` | 替换默认的 `TxInput`。 |
| `tags` | - | 标题旁的元信息。 |

### TxBlockSelect

#### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|-------------|
| `modelValue` | `string \| number` | `''` | 选中值，配合 `v-model`。 |
| `title` | `string` | `''` | 行标题。 |
| `description` | `string` | `''` | 行描述。 |
| `defaultIcon` | `TxIconSource \| string` | - | 未选值时的图标，也是 `activeIcon` 的回退。 |
| `activeIcon` | `TxIconSource \| string` | - | 已选值时的图标。 |
| `disabled` | `boolean` | `false` | 禁用行与选择器。 |
| `placeholder` | `string` | `''` | 占位文本。 |

#### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `update:modelValue` | `value: string \| number` | 选中值变化时触发。 |
| `change` | `value: string \| number` | 与 `update:modelValue` 同时触发。 |

#### 插槽

| 插槽名 | 参数 | 说明 |
|------|------|------|
| `default` | - | `TxSelect` 的选项，如 `TuffSelectItem`。 |
| `tags` | - | 标题旁的元信息。 |

### TxBlockSwitch

#### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|-------------|
| `modelValue` | `boolean` | *必填* | 开关值，配合 `v-model`。 |
| `title` | `string` | *必填* | 行标题。 |
| `description` | `string` | *必填* | 行描述。 |
| `defaultIcon` | `TxIconSource \| string` | - | 关闭时的图标，也是 `activeIcon` 的回退。 |
| `activeIcon` | `TxIconSource \| string` | - | 开启时的图标；未设置时用 `defaultIcon`。 |
| `disabled` | `boolean` | `false` | 禁用行与开关。 |
| `guidance` | `boolean` | `false` | 以箭头替代开关，作为导航行。 |
| `loading` | `boolean` | `false` | 透传给内部开关：滑块转为旋转环，行叠加 shimmer 并暂停交互。 |

#### 事件

| 事件名 | 参数 | 说明 |
|------|------|------|
| `update:modelValue` | `value: boolean` | 开关值变化时触发。 |
| `change` | `value: boolean` | 用户切换后透传开关的 `change`。 |
| `click` | `event: MouseEvent` | 仅 `guidance` 模式触发。 |

#### 插槽

| 插槽名 | 参数 | 说明 |
|------|------|------|
| `tags` | - | 标题旁的元信息。 |

## 概述

- 首屏展开状态依次取持久化值、`defaultExpand`、`!collapsed`；用户切换后，props 变化不再覆盖当前状态。
- 分组内容始终挂载，折叠只改变高度、透明度与 `display`。
- 分组重置组内每行的 `--fake-radius` 与外边距，圆角只出现在分组卡片上；单独使用的行保留 12px 圆角。
- `TxBlockLine` 默认是非交互的 `div`，`link` 时才是 `<button type="button">`。
- `TxBlockSlot` 的控件区不收缩；`TxBlockInput` 例外，输入框可收缩到 120px，为标题让出空间。
- `TxBlockSwitch` 的忙碌提示只在内部开关上（`is-loading` + `aria-busy`），行只叠加 shimmer；`guidance` 模式不改写 `modelValue`。

## 技术实现

- 展开与折叠由 GSAP 过渡高度和透明度，结束后释放为 `auto` 或 `display: none`。
- 源码：`packages/tuffex/packages/components/src/group-block/`。



## 自定义

| 主题变量 | 用途 |
|-------------|----------|
| `--tx-border-color-lighter` | 分组边框与头部分隔线。 |
| `--tx-fill-color-dark` / `--tx-fill-color` / `--tx-fill-color-light` | 头部、行与悬停表面。 |
| `--tx-text-color-primary` / `--tx-text-color-secondary` | 标题、标签、描述、引导箭头与加载环。 |
| `--tx-color-primary` / `--tx-color-primary-dark-2` | 链接行的文字色与悬停色。 |
| `--tx-color-white` | 加载 shimmer 的高光。 |

## 离线完整示例源码

- [GroupBlockGroupBlockDemo](../snapshot/apps/nexus/app/components/content/demos/GroupBlockGroupBlockDemo.vue.txt)
- [GroupBlockGroupBlockCollapsedDemo](../snapshot/apps/nexus/app/components/content/demos/GroupBlockGroupBlockCollapsedDemo.vue.txt)
- [GroupBlockGroupBlockMemoryDemo](../snapshot/apps/nexus/app/components/content/demos/GroupBlockGroupBlockMemoryDemo.vue.txt)
- [GroupBlockGroupBlockHeaderExtraDemo](../snapshot/apps/nexus/app/components/content/demos/GroupBlockGroupBlockHeaderExtraDemo.vue.txt)
- [GroupBlockBlockLineBasicDemo](../snapshot/apps/nexus/app/components/content/demos/GroupBlockBlockLineBasicDemo.vue.txt)
- [GroupBlockBlockLineLinkDemo](../snapshot/apps/nexus/app/components/content/demos/GroupBlockBlockLineLinkDemo.vue.txt)
- [GroupBlockBlockSlotDemo](../snapshot/apps/nexus/app/components/content/demos/GroupBlockBlockSlotDemo.vue.txt)
- [GroupBlockBlockSlotActiveDemo](../snapshot/apps/nexus/app/components/content/demos/GroupBlockBlockSlotActiveDemo.vue.txt)
- [GroupBlockBlockSlotCustomLabelDemo](../snapshot/apps/nexus/app/components/content/demos/GroupBlockBlockSlotCustomLabelDemo.vue.txt)
- [GroupBlockBlockInputDemo](../snapshot/apps/nexus/app/components/content/demos/GroupBlockBlockInputDemo.vue.txt)
- [GroupBlockBlockSelectDemo](../snapshot/apps/nexus/app/components/content/demos/GroupBlockBlockSelectDemo.vue.txt)
- [GroupBlockBlockSwitchDemo](../snapshot/apps/nexus/app/components/content/demos/GroupBlockBlockSwitchDemo.vue.txt)
- [GroupBlockBlockSwitchLoadingDemo](../snapshot/apps/nexus/app/components/content/demos/GroupBlockBlockSwitchLoadingDemo.vue.txt)
- [GroupBlockBlockSwitchDisabledDemo](../snapshot/apps/nexus/app/components/content/demos/GroupBlockBlockSwitchDisabledDemo.vue.txt)
- [GroupBlockBlockSwitchGuidanceDemo](../snapshot/apps/nexus/app/components/content/demos/GroupBlockBlockSwitchGuidanceDemo.vue.txt)

## 离线类型与实现参考

- [group-block/index.ts](../snapshot/packages/tuffex/packages/components/src/group-block/index.ts.txt)
- [src/TxBlockInput.vue](../snapshot/packages/tuffex/packages/components/src/group-block/src/TxBlockInput.vue.txt)
- [src/TxBlockLine.vue](../snapshot/packages/tuffex/packages/components/src/group-block/src/TxBlockLine.vue.txt)
- [src/TxBlockSelect.vue](../snapshot/packages/tuffex/packages/components/src/group-block/src/TxBlockSelect.vue.txt)
- [src/TxBlockSlot.vue](../snapshot/packages/tuffex/packages/components/src/group-block/src/TxBlockSlot.vue.txt)
- [src/TxBlockSwitch.vue](../snapshot/packages/tuffex/packages/components/src/group-block/src/TxBlockSwitch.vue.txt)
- [src/TxGroupBlock.vue](../snapshot/packages/tuffex/packages/components/src/group-block/src/TxGroupBlock.vue.txt)
- [src/types.ts](../snapshot/packages/tuffex/packages/components/src/group-block/src/types.ts.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
