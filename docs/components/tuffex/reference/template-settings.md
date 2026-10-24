# Settings 设置中心

> 分区导航、分组设置行、改动即时保存的设置中心

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/template-settings) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/template-settings.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/template-settings.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.6.0`，syncStatus=`reviewed`，verified=`false`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 分区设置页
官方示例：`TemplateSettingsDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import TemplateFrame from './TemplateFrame.vue'

// TxTabs 只渲染当前面板、切走就卸载，所以所有值放在同一个对象里
const settings = reactive({ theme: 'system', opacity: 92, density: 'cozy', maxResults: 8 })
const page = ref('general')
const saveState = ref<'idle' | 'saving' | 'saved'>('idle')

let timer: ReturnType<typeof setTimeout> | undefined
watch(settings, () => {
  saveState.value = 'saving'
  clearTimeout(timer)
  timer = setTimeout(() => (saveState.value = 'saved'), 600)
}, { deep: true })
</script>

<template>
  <TemplateFrame title="Settings" @enter="play">
    <template #default="{ width }">
      <div class="settings">
        <!-- navMinWidth 是内联样式，窄屏只能靠 prop 把导航挪到顶部 -->
        <TxTabs
          v-model="page"
          :placement="width > 0 && width < 640 ? 'top' : 'left'"
          :nav-min-width="184"
          :content-padding="0"
          borderless
          indicator-variant="block"
        >
          <TxTabHeader>
            <h3>{{ titles[page] }}</h3>
            <TxStatusBadge :text="saveText[saveState]" :status="saveState === 'saved' ? 'success' : 'info'" size="sm" />
            <TxButton size="sm" variant="ghost" icon="i-carbon-reset" @click="ask('reset')">
              重置
            </TxButton>
          </TxTabHeader>

          <TxTabItemGroup name="通用">
            <TxTabItem name="general" icon-class="i-carbon-settings">
              <template #name>
                通用
              </template>
              <TxGroupBlock name="外观" default-icon="i-carbon-color-palette" :collapsible="false">
                <TxBlockSlot title="主题" description="浅色、深色或跟随系统">
                  <TxFlatRadio v-model="settings.theme" size="sm">
                    <TxFlatRadioItem value="light" label="浅色" icon="i-carbon-sun" />
                    <TxFlatRadioItem value="dark" label="深色" icon="i-carbon-moon" />
                    <TxFlatRadioItem value="system" label="跟随系统" icon="i-carbon-screen" />
                  </TxFlatRadio>
                </TxBlockSlot>
                <TxBlockSlot title="窗口透明度" description="CoreBox 背后透出多少桌面">
                  <TxSlider v-model="settings.opacity" :min="60" :max="100" show-value />
                </TxBlockSlot>
              </TxGroupBlock>
            </TxTabItem>
            <!-- CoreBox、快捷键 -->
          </TxTabItemGroup>
          <!-- 智能：AI 模型、隐私；账户 -->
        </TxTabs>

        <aside v-if="width >= 960" class="settings__preview">
          <!-- 迷你 CoreBox：主题、透明度、密度、条数都读自 settings -->
        </aside>

        <TxModal v-model="confirmOpen" :title="confirm.title">
          {{ confirm.body }}
        </TxModal>
      </div>
    </template>
  </TemplateFrame>
</template>
```

## 概述

Tuff 的设置中心：改动即时保存，页头只显示保存状态，没有「保存」按钮。

- 改动后页头显示「保存中…」，600ms 内无新改动即变为「已保存 · 刚刚」。
- 呼出快捷键可录制：组合须含 ⌘、⌃ 或 ⌥，Esc 或点别处取消。
- 快捷键页可筛选、逐个启停；AI 页的 API Key 默认遮盖（示例值）。
- 重置、清空剪贴板历史、退出其他设备都先确认。
- 进入视口后自动演示一次，读者一操作即停止；减少动态效果时直接显示最终状态，并关闭分区切换动画。
- 宽屏（≥ 960px）右侧出现实时预览；窄屏（< 640px）导航移到顶部，控件换到标签下方。

## 自定义

- 接真实存储时，把 `watch(settings)` 里的计时器换成防抖写入；失败时把状态改为「未保存」并给出重试。
- 新分区的 TxTabItem 用稳定的英文 `name`，标签放进 `#name` 插槽，切换语言时当前分区才不会丢。
- TxTabs 会卸载切走的面板：值不要存在行组件里，头像的 object URL 也要自己持有一份。
- TxGroupBlock 统一 `collapsible=false`（gsap 驱动的展开没有减弱动态效果兜底），也不设会写 localStorage 的 `memoryName`。
- 敏感字段放在分组正文，不放进 56px 设置行；TxFlatSelect 就地展开、不 teleport，要避开滚动容器的裁切。

## 相关组件

| 区域 | 组件 | 作用 |
|---|---|---|
| 导航 | [TxTabs / TxTabItemGroup / TxTabItem](./tabs.md) | 分组的分区导航 |
| 页头 | [TxTabs](./tabs.md) 的 TxTabHeader、[TxStatusBadge](./status-badge.md)、[TxButton](./button.md) | 分区标题、保存状态与重置 |
| 设置行 | [TxGroupBlock / TxBlockSlot / TxBlockLine](./group-block.md) | 固定展开的分组与设置行 |
| 通用与 CoreBox | [TuffSwitch](./switch.md)、[TxFlatSelect](./flat-select.md)、[TxFlatRadio](./flat-radio.md)、[TxSlider](./slider.md)、[TxSelect](./select.md)、[TxSegmentedSlider](./segmented-slider.md)、[TxNumberInput](./number-input.md)、[TxInput](./input.md)、[TxKbd](./kbd.md) | 外观、快捷键与结果设置 |
| 快捷键 | [TxSearchInput](./search-input.md)、[TxKbd](./kbd.md)、[TuffSwitch](./switch.md)、[TxSearchEmpty](./search-empty.md) | 可筛选、可启停的快捷键 |
| AI 与隐私 | [TxAlert](./alert.md)、[TxSensitiveInput](./sensitive-input.md)、[TxCheckbox](./checkbox.md)、[TxRadioGroup / TxRadio](./radio.md) | 服务商、密钥与隐私选项 |
| 账户 | [TxAvatar](./avatar.md)、[TxImageUploader](./image-uploader.md) | 头像、名称、邮箱与套餐 |
| 确认框 | [TxModal](./modal.md)、[TxCheckbox](./checkbox.md) | 危险操作前的确认 |
| 实时预览（宽屏） | [TxIconChip](./icon-chip.md)、手写迷你 CoreBox | 迷你 CoreBox 预览 |

## 离线完整示例源码

- [TemplateSettingsDemo](../snapshot/apps/nexus/app/components/content/demos/TemplateSettingsDemo.vue.txt)

## 离线类型与实现参考

本页是跨组件/概念说明；先按具体组件查询 catalog.json，再按 SOURCE 清单核对；不要从名称猜导出。

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
