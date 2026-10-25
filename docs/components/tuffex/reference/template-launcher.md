# Launcher 启动器

> 仿 CoreBox、带实时预览的键盘优先启动器

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/template-launcher) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/template-launcher.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/template-launcher.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.6.0`，syncStatus=`reviewed`，verified=`false`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### CoreBox 式启动器
官方示例：`TemplateLauncherDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import TemplateFrame from './TemplateFrame.vue'

const query = ref('')
const scope = ref('all')
const activeIndex = ref(0)
const results = computed(() => search(query.value, scope.value))
const active = computed(() => results.value[activeIndex.value])
const listId = useId()

// 键盘全在输入框上：焦点一直留在输入框，用 aria-activedescendant 指向高亮项
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    move(event.key === 'ArrowDown' ? 1 : -1)
  }
  else if (event.key === 'Enter') {
    event.preventDefault()
    run(active.value)
  }
  else if (event.key === 'Escape' && query.value) {
    event.preventDefault()
    query.value = ''
  }
  else if (event.key === 'Escape' && scope.value !== 'all') {
    event.preventDefault()
    scope.value = 'all'
  }
}
</script>

<template>
  <TemplateFrame title="Launcher" @enter="playTyping">
    <div class="launcher">
      <TxGlassSurface width="100%" height="100%" :border-radius="18">
        <TxSearchInput
          v-model="query"
          role="combobox"
          aria-expanded="true"
          :aria-controls="listId"
          :aria-activedescendant="`${listId}-${activeIndex}`"
          @keydown="onKeydown"
        />
        <TxFilterChips v-model="scope" :items="scopes" />
        <div :id="listId" role="listbox">
          <div
            v-for="(item, index) in results"
            :id="`${listId}-${index}`"
            :key="item.id"
            role="option"
            :aria-selected="index === activeIndex"
          >
            <TxIconChip :size="30" :tone="item.tone" variant="soft">
              <i :class="item.icon" />
            </TxIconChip>
            {{ item.title }}
            <TxTag :label="item.kind" size="sm" variant="soft" />
            <TxKbd v-if="index < 5">⌘{{ index + 1 }}</TxKbd>
          </div>
        </div>
        <TxMarkdownView :content="active?.preview ?? tips" />
        <footer>
          <TxDropdownMenu v-model="actionsOpen" placement="top-end">
            <!-- 打开、在访达中显示、固定到推荐、停用插件 -->
          </TxDropdownMenu>
          <TxStatusBadge text="索引中 82%" status="info" size="sm" />
        </footer>
      </TxGlassSurface>
    </div>
  </TemplateFrame>
</template>
```

## 概述

仿 Tuff CoreBox 的启动器：一个输入框跨类搜索，高亮项实时预览，全程不离开键盘。

- 搜索覆盖应用、插件、文件、剪贴板、AI 与系统动作，范围条计数跟随查询；输入 `128*4` 这类算式，第一行直接给出结果。
- ↑ ↓ 移动高亮，预览同步切换；↵ 执行；⌘K 打开当前结果的操作菜单，固定的条目排到推荐最前。
- Esc 分两层：先清空输入，再把范围重置为「全部」。
- 无结果时出现「问问 Tuff 智能」，点击后查询变为 AI 提问。
- 进入视口后自动演示一次，不聚焦输入框；输入或点击即停止；减少动态效果时直接显示最终状态。
- ⌘1–⌘5 仅为提示（浏览器保留了 ⌘ 加数字）；宽屏（≥ 960px）出现 Dock，窄屏（< 640px）收起预览。

## 自定义

- 接真实数据时，把 `CATALOG` 换成索引接口的返回，保留 `kind`、`tone`、`keywords`；`scoreEntry()` 给标题开头命中 3 分、标题包含 2 分、关键词或副标题 1 分。
- 没用 TxSearchPanel：它不上报高亮项，也不暴露输入框；只需内联搜索、不要预览时直接用它。
- 全局唤起时，把窗体放进 TxModal 或自己的 Teleport 浮层；唤起快捷键挂在宿主根节点，不挂 `window`。
- 预览 markdown 不放链接：TxMarkdownView 渲染真实的 `<a>`；桌面应用里拦截 click，交给宿主打开。

## 相关组件

| 区域 | 组件 | 作用 |
|---|---|---|
| 桌面 | [TxIconChip](./icon-chip.md)、手写壁纸与菜单栏 | 渐变壁纸；宽屏加 Dock |
| 窗体 | [TxGlassSurface](./glass-surface.md) | 折射玻璃窗体 |
| 输入 | [TxSearchInput](./search-input.md)、[TxKbd](./kbd.md) | 处理方向键、↵ 与 Esc |
| 范围 | [TxFilterChips](./filter-chips.md) | 分类范围与命中数 |
| 结果 | 自建 listbox、[TxIconChip](./icon-chip.md)、[TxTag](./tag.md)、[TxKbd](./kbd.md)、[TxSearchEmpty](./search-empty.md) | 最佳匹配、⌘ 提示与无结果 |
| 预览 | [TxMarkdownView](./markdown-view.md) | 跟随高亮的详情 |
| 底栏 | [TxDropdownMenu](./dropdown-menu.md)、[TxStatusBadge](./status-badge.md) | 反馈、操作菜单与索引进度 |

## 离线完整示例源码

- [TemplateLauncherDemo](../snapshot/apps/nexus/app/components/content/demos/TemplateLauncherDemo.vue.txt)

## 离线类型与实现参考

本页是跨组件/概念说明；先按具体组件查询 catalog.json，再按 SOURCE 清单核对；不要从名称猜导出。

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
