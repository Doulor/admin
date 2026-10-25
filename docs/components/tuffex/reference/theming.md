# 主题定制

> 从全局 token 到单个组件的四层主题覆盖

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/theming) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/theming.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/theming.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.4.0`，syncStatus=`reviewed`，verified=`false`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 定制模型

组件不写死颜色，视觉全部读取 CSS 自定义属性，换主题只改样式表。四层由宽到窄，选能解决问题的**最窄**一层。

| 层级 | 定义位置 | 影响范围 |
|------|----------|----------|
| 全局 token | `base.css` 里的 `:root` | 全部 |
| 主题选择器 | `[data-theme='dark']`、`[data-tx-contrast='high']` | 整个模式 |
| BUI token | `--tx-bui-*` | AI 套件 |
| 组件变量 | `--tx-<component>-*` | 单个组件，或某个子树 |

token 清单见《[Design Foundations 设计基础](./foundations.md)》。

## 全局 token

在引入 `base.css` 之后重定义。组件绘制时才解析变量，覆盖对其下整棵子树生效。

```css
@import '@talex-touch/tuffex/base.css';

:root {
  --tx-color-primary: #7c5cff;
  --tx-border-radius-base: 8px;
  --tx-transition-duration: 0.24s;
}
```

`--tx-color-primary-soft`、`--tx-coloring-border-color` 由 `--tx-color-primary` 经 `color-mix()` 派生，自动跟随；主色阶梯 `--tx-color-primary-light-*`、`--tx-color-primary-dark-2` 是固定色值（默认焦点环也取自其中），换品牌色时一并覆盖。

## 深色模式

深色是选择器，不是媒体查询：在任意祖先上设置 `data-theme="dark"` 或 `dark` class。

```html
<html data-theme="dark">
<!-- 或 -->
<html class="dark">
```

- 两种写法等价：Tailwind 应用（`.dark`）与 `data-theme` 应用都无需适配层。
- 设在子树上，即可在浅色页面里开一块深色区域。
- 深色下三档强调字重各调轻 40，抵消白字在暗底上的光渗膨胀：`--tx-font-weight-medium` 500 → 460、`--tx-font-weight-semibold` 600 → 560、`--tx-font-weight-bold` 700 → 660，正文 400 不变。自己写的样式以 `var(--tx-font-weight-medium, 500)` 读取即可跟随；覆盖时让暗色值落在（浅色值 − 100，浅色值］之内，否则静态字体会换成另一个字面，见《[暗色视网膜光晕与字重微调补偿](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/concepts/irradiation-tuning.zh.mdc)》。

### 视图过渡动效（View Transition）

切换深色/浅色时，Tuffex 提供了基于原生 View Transitions API 的平滑过渡封装 `applyThemeTransition`。默认预设为 `circle-blur`，以鼠标点击坐标为圆心，通过 SVG 高斯模糊遮罩向外扩散展开新主题，视觉轻盈柔和。

同时支持 `circle`（硬边裁切圆）、`polygon`（斜切光刃）、`polygon-gradient`（渐变光刃）、`wipe`（平推扫光）、`fade`（平滑淡入淡出）以及自定义 GIF 遮罩。

官方示例：`ThemingThemeTransitionDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { applyThemeTransition } from '@talex-touch/tuffex/utils'
import { ref } from 'vue'

const isDark = ref(false)

function toggle(event: MouseEvent) {
  applyThemeTransition(() => {
    isDark.value = !isDark.value
    document.documentElement.classList.toggle('dark', isDark.value)
  }, {
    origin: event,
    variant: 'circle-blur',
    duration: 450,
    blurAmount: 3.5,
  })
}
</script>

<template>
  <button @click="toggle">
    {{ isDark ? '浅色' : '深色' }}
  </button>
</template>
```

#### 预设变体与配置

| 变体名称 (`variant`) | 默认时长 | 视觉特点 |
|----------------------|----------|----------|
| `circle-blur` (默认) | 450ms | 以点击坐标为原点，带柔和高斯模糊的圆形光晕展开 |
| `circle` | 350ms | 以点击坐标为原点，`clip-path: circle` 锐利圆形裁切展开 |
| `polygon` | 600ms | 对角线光刃斜切拉开新主题 |
| `polygon-gradient` | 800ms | 线性渐变柔和边缘的光刃斜切 |
| `wipe` | 400ms | 水平横向扫光推进 |
| `fade` | 250ms | 经典跨主题淡入淡出（轻量回退） |
| `circle-blur-top-left`| 600ms | 从左上角原点以模糊圆展开 |
| `gif` | 1500ms | 传入 `maskUrl` 使用动态图形展开新主题 |

- **原点自动解析**：`origin` 可传入原生 `MouseEvent`、`{ clientX, clientY }` 或 `[x, y]`，未指定时默认从视口中心扩散。
- **无障碍保障**：系统检测到用户开启 `prefers-reduced-motion` 或浏览器不支持 View Transition 时，自动静默直切，无冗余动画。

## 高对比度

第四套调色板，在浅色与深色下都提高文本与边框对比度。

| 触发条件 | 效果 |
|----------|------|
| `html[data-tx-contrast='high']` 或 `html.contrast` | 显式开启 |
| `@media (prefers-contrast: more)` | 跟随系统自动开启 |
| `html[data-tx-contrast='normal']` | **退出**上面的媒体查询 |

`data-theme="dark"` 与任一开启条件同时存在时，使用「深色高对比度」调色板，而不是两套主题叠加。

### 材质

高对比度下，组件不再透出页面：

| 部件 | 高对比度下 |
|------|-----------|
| 材质面板：`TxBaseSurface` 除 `plain` 外的所有模式（Card、BaseAnchor 浮层、命令面板与各类对话框等都基于它；`plain` 本来不画材质，高对比度下也不加底色）、GlassSurface、Toast、NavBar、TabBar、Picker、Slider、RadioGroup 指示块、ProgressBar 遮罩、StatCard、Drawer 的透明面板、MotionTransition 的玻璃幕 | 不透明底色，不模糊、不折射、没有边缘高光 |
| 遮罩：Modal、Drawer、BlowDialog | 保留压暗，去掉磨砂 |
| 盖在内容上的层：LoadingOverlay、Card 与 DataTable 的加载层、ImageUploader 的删除按钮 | 不透明，遮住下面的内容 |
| 装饰：FlowLight、GlowText 的扫光、GradualBlur | 隐藏 |

组件内部的浅色叠层（悬停、选中、输入框底色）保持不变。规则写在 `style/mixins.scss` 的 `tx-when-high-contrast` 里，与调色板响应同一组触发条件。

## AI 套件 token

`--tx-bui-*` 随 Beautiful UI 组件移植（surface、inset、field、ink，accent / green / orange / red / violet 及配套 tint），在同样的 `[data-theme='dark']` / `.dark` 下有自己的深色块。AI 界面不继承品牌色时单独覆盖：

```css
:root {
  --tx-bui-accent: #7c5cff;
  --tx-bui-accent-tint: #f0ecff;
}
```

## 组件变量

`--tx-<component>-*` 只改单个组件，不动全局调色板。命名可预期（`--tx-collapse-header-bg`、`--tx-avatar-ring-color`、`--tx-progress-height`），每个都有兜底值；它们可继承，设在外层容器上只作用于该子树。

```vue
<template>
  <section class="settings-panel">
    <TxCollapse v-model="open">
      <TxCollapseItem title="外观" name="appearance">…</TxCollapseItem>
    </TxCollapse>
  </section>
</template>

<style scoped>
.settings-panel {
  --tx-collapse-radius: 6px;
  --tx-collapse-header-bg: transparent;
  --tx-collapse-border: rgba(148, 163, 184, 0.24);
}
</style>
```

每个组件页列出它读取的变量。用变量，不用后代选择器改组件内部：自定义属性是对外接口，class 名不是。

## 注意

- 组件已暴露填充变量时改 token，不写 `background-color`：有些填充是 `background-image` 渐变，`background-color` 只会画在渐变背后。
- `base.css` 只引一次。引两份时以后加载的为准，通常不是你改的那份。

## 技术实现

- token 与主题选择器：`packages/tuffex/packages/components/style/variables.scss`。
- AI 套件 token：`packages/tuffex/packages/components/style/bui-tokens.scss`。
- 运行时入口：`@talex-touch/tuffex/base.css`。

## 离线完整示例源码

- [ThemingThemeTransitionDemo](../snapshot/apps/nexus/app/components/content/demos/ThemingThemeTransitionDemo.vue.txt)

## 离线类型与实现参考

- [style/bui-tokens.scss](../snapshot/packages/tuffex/packages/components/style/bui-tokens.scss.txt)
- [style/index.scss](../snapshot/packages/tuffex/packages/components/style/index.scss.txt)
- [style/mixins.scss](../snapshot/packages/tuffex/packages/components/style/mixins.scss.txt)
- [style/variables.scss](../snapshot/packages/tuffex/packages/components/style/variables.scss.txt)

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
