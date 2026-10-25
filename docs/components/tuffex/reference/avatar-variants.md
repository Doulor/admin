# Avatar Variants 头像变体

> 为头像添加状态点、角标与描边的组合配方

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/avatar-variants) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/avatar-variants.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/avatar-variants.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`1.0.0`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 画廊
`TxAvatar` 与 `TxCornerOverlay`、`TxOutlineBorder`、`TxIcon` 的组合，按状态、活动、平台、系统、社交、上下文分组。
官方示例：`AvatarVariantsAvatarVariantsGalleryDemo`（完整源码见本页末尾）

```vue
<!-- 三个代表性配方；完整的 30+ 变体见 demo 源码 -->
<template>
  <!-- 在线状态点 -->
  <TxCornerOverlay placement="bottom-right" :offset-x="-2" :offset-y="-2">
    <TxAvatar src="https://i.pravatar.cc/150?u=online" size="large" />
    <template #overlay>
      <span class="tx-avatar-variants__dot tx-avatar-variants__dot--online" />
    </template>
  </TxCornerOverlay>

  <!-- 平台角标 -->
  <TxCornerOverlay placement="bottom-right" :offset-x="-4" :offset-y="-4">
    <TxAvatar size="large" background-color="var(--tx-fill-color-light)">
      <TxIcon name="i-carbon-chat" :size="24" style="color: var(--tx-color-success)" />
    </TxAvatar>
    <template #overlay>
      <span class="tx-avatar-variants__badge tx-avatar-variants__badge--light">
        <TxIcon name="i-carbon-mobile" :size="14" style="color: var(--tx-text-color-secondary)" />
      </span>
    </template>
  </TxCornerOverlay>

  <!-- 描边环 + 认证角标 -->
  <TxOutlineBorder variant="ring" :ring-width="2" ring-color="var(--tx-color-primary)" :padding="2" clip-mode="none">
    <TxCornerOverlay placement="bottom-right" :offset-x="-4" :offset-y="-4">
      <TxAvatar src="https://i.pravatar.cc/150?u=verified" size="large" />
      <template #overlay>
        <span class="tx-avatar-variants__badge tx-avatar-variants__badge--primary">
          <TxIcon name="i-carbon-checkmark-filled" :size="14" class="tx-avatar-variants__icon--white" />
        </span>
      </template>
    </TxCornerOverlay>
  </TxOutlineBorder>
</template>
```

### 最佳实践

- 只复制所需的最小模式，不要导入整个画廊 demo。
- 角标表示用户状态时，在相邻文本或父级控件的 label 中写明状态，不要只靠颜色或图标形状。
- 纯装饰角标用空 `alt` 或 `aria-hidden`。

## 技术实现

- 本页是配方画廊，不是导出的组件；角标样式是 demo 内的本地 CSS 类。
- 源码：`apps/nexus/app/components/content/demos/AvatarVariantsAvatarVariantsGalleryDemo.vue`、`AvatarVariantCard.vue`；组件见 `packages/tuffex/packages/components/src/avatar/`、`corner-overlay/`、`outline-border/`。

## 离线完整示例源码

- [AvatarVariantsAvatarVariantsGalleryDemo](../snapshot/apps/nexus/app/components/content/demos/AvatarVariantsAvatarVariantsGalleryDemo.vue.txt)

## 离线类型与实现参考

本页是跨组件/概念说明；先按具体组件查询 catalog.json，再按 SOURCE 清单核对；不要从名称猜导出。

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
