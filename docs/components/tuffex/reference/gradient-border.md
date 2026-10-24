# GradientBorder 渐变边框

> 环绕内容旋转的渐变边框包装器

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/gradient-border) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/gradient-border.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/gradient-border.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.3.4`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 基础
官方示例：`GradientBorderGradientBorderDemo`（完整源码见本页末尾）

```vue
<template>
  <TxGradientBorder :padding="16" :border-radius="16">
    <div class="surface">Content</div>
  </TxGradientBorder>
</template>
```

### 语义化根节点
`as` 指定根元素，如 `section` 或 `li`。

```vue
<template>
  <TxGradientBorder as="section" :border-width="3" :border-radius="20" padding="1rem 1.25rem">
    <article class="rounded-[16px] bg-[var(--tx-bg-color)] p-4">
      <h3>候选版本</h3>
      <p>已准备进入人工 QA。</p>
    </article>
  </TxGradientBorder>
</template>
```

### 自定义单位
字符串尺寸原样保留，可以使用 CSS 变量和多值 padding。

```vue
<template>
  <TxGradientBorder
    border-width="0.125rem"
    border-radius="var(--radius-lg)"
    padding="1rem 1.5rem"
    :animation-duration="6"
  >
    <div class="rounded-[inherit] bg-[var(--tx-bg-color)] p-4">
      使用项目 token
    </div>
  </TxGradientBorder>
</template>
```

### 最佳实践

- 内部放一块自带背景的表面，圆角取 `borderRadius - borderWidth`，避免露出尖角。
- 需要语义时用 `as` 指定根元素，不要在外面再套一层 landmark。
- 一个区块只保留一个渐变高亮面，同屏多个时放慢 `animationDuration`；小的状态点用 `TxBadge` 或 `TxTag`。
- 焦点环需要外溢的控件不要直接包进来，或由内部内容自行处理焦点样式。

## API 参考

### 属性

| 属性名 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| `as` | `string` | `'div'` | 根元素标签。 |
| `borderWidth` | `string \| number` | `'2px'` | 边框宽度，也是光晕的模糊半径；数字按 px。 |
| `borderRadius` | `string \| number` | `'12px'` | 包装器与渐变环的圆角；数字按 px。 |
| `padding` | `string \| number` | `'12px'` | 内容包装器的内边距；数字按 px。 |
| `animationDuration` | `number` | `4` | 旋转一圈的秒数。 |

### 插槽

| 插槽名 | Props | 说明 |
|------|------|------|
| `default` | - | 渲染在 `.tx-gradient-border__inner` 内的内容。 |

### CSS 变量

| 变量 | 来源 | 说明 |
|------|------|------|
| `--tx-gradient-border-width` | `borderWidth` | 边框厚度与模糊距离。 |
| `--tx-gradient-border-radius` | `borderRadius` | 包装器与渐变环的圆角。 |
| `--tx-gradient-inner-padding` | `padding` | 内容包装器的内边距。 |
| `--tx-gradient-duration` | `animationDuration` | 旋转时长，带 `s` 后缀。 |
| `--tx-gradient-angle` | 内部动画 | 渐变使用的注册角度属性。 |
| `--tx-gradient-border-color-1` … `-4` | — | 渐变的四个色标，默认依次为 `#0894ff`、`#c959dd`、`#ff2e54`、`#ff9004`。 |

## 概述

- 根元素由 `as` 决定，插槽外包一层 `.tx-gradient-border__inner`。
- 渐变环在独立的 `aria-hidden` 层上，`pointer-events: none`；交互由插槽内容负责。
- 渐变环跟随 `borderRadius`，光晕不被裁剪，向包装器边缘内外扩散。
- `.tx-gradient-border__inner` 以同样的圆角 `overflow: hidden`，超出的子元素焦点环或阴影会被裁掉。
- 减少动态效果时停止旋转，边框停在静态的渐变角度。

## 技术实现

- 渐变环由 `mask` 从实心盒中抠出，模糊放在它的父层上，因为同一元素上 `filter` 先于 `mask` 执行；旋转由注册的 `--tx-gradient-angle` 驱动。
- 源码：`packages/tuffex/packages/components/src/gradient-border/`。

## 离线完整示例源码

- [GradientBorderGradientBorderDemo](../snapshot/apps/nexus/app/components/content/demos/GradientBorderGradientBorderDemo.vue.txt)

## 离线类型与实现参考

- [gradient-border/index.ts](../snapshot/packages/tuffex/packages/components/src/gradient-border/index.ts.txt)
- [src/TxGradientBorder.vue](../snapshot/packages/tuffex/packages/components/src/gradient-border/src/TxGradientBorder.vue.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
