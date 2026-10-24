# Onboarding 登录引导

> 从登录、工作区、偏好到系统权限的五步首启引导

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/template-onboarding) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/template-onboarding.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/template-onboarding.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.6.0`，syncStatus=`reviewed`，verified=`false`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## 用法

### 首启引导
官方示例：`TemplateOnboardingDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import TemplateFrame from './TemplateFrame.vue'

const step = ref(0)
const entered = ref(false)
const perms = reactive({ files: 'unchecked', accessibility: 'unchecked', screen: 'unchecked' })

// TxBorderBeam 默认按深色背景调色，auto 读的是系统而不是站点：显式传站点主题
const colorMode = useColorMode()
const beamTheme = computed(() => (colorMode.value === 'dark' ? 'dark' : 'light'))

// 入场特效挂载即播，所以等舞台进入视口再挂载
function onEnter() {
  entered.value = true
}

// 授权只由读者的点击触发；等待时长代替系统弹窗
function grant(key: keyof typeof perms) {
  perms[key] = 'pending'
  setTimeout(() => {
    perms[key] = 'granted'
  }, 1200)
}
</script>

<template>
  <TemplateFrame title="首启引导" :height="560" @enter="onEnter">
    <template #default="{ width }">
      <div class="onb" :class="{ 'is-narrow': width > 0 && width < 640 }">
        <aside class="onb__rail">
          <TxTuffLogoStroke v-if="entered" :size="56" mode="once" />
          <TxKeyframeStrokeText v-if="entered" text="欢迎来到 Tuff" :font-size="24" fill-color="var(--tx-text-color-primary)" />
          <TxSteps direction="vertical" size="small" :active="step">
            <!-- TxSteps 没有 emit：回退由宿主在原生 click 里判断 -->
            <TxStep v-for="(item, i) in steps" :key="item.key" :step="i" :title="item.title" :clickable="i < step" @click="i < step && (step = i)" />
          </TxSteps>
        </aside>

        <main class="onb__main">
          <TxProgressBar :percentage="(step + 1) * 20" height="4px" aria-label="引导进度" />
          <TxTransition preset="slide-fade" :appear="false">
            <section v-if="step === 0" key="signin">
              <TxBorderBeam size="sm" :theme="beamTheme" :active="!reducedMotion">
                <TxButton block size="lg" :loading="pending === 'passkey'" @click="signIn('passkey')">
                  Passkey 登录
                </TxButton>
              </TxBorderBeam>
              <TxForm :model="form" :rules="rules" label-position="top" @submit="sendMagicLink">
                <TxFormItem label="邮箱" prop="email">
                  <template #default="{ id }">
                    <TxInput :id="id" v-model="form.email" type="email" />
                  </template>
                </TxFormItem>
                <TxButton native-type="submit" variant="primary" block>使用邮箱继续</TxButton>
              </TxForm>
            </section>
            <section v-else-if="step === 3" key="perms">
              <TxStatusBadge :text="statusText(perms.files)" :status="statusTone(perms.files)" size="sm" />
              <TxButton size="sm" :loading="perms.files === 'pending'" @click="grant('files')">允许访问</TxButton>
            </section>
            <!-- 工作区、偏好、完成三步从略 -->
          </TxTransition>
          <footer class="onb__footer">
            <TxButton variant="ghost" :disabled="step === 0" @click="step--">上一步</TxButton>
            <TxButton variant="primary" :disabled="!canContinue" @click="step++">继续</TxButton>
          </footer>
        </main>
      </div>
    </template>
  </TemplateFrame>
</template>

<style scoped>
.onb {
  display: grid;
  grid-template-columns: 264px minmax(0, 1fr);
  height: 100%;
}

.onb.is-narrow {
  grid-template-columns: minmax(0, 1fr);
}
</style>
```

## 概述

Tuff 桌面版的首启引导：每一步都是模拟，不发请求，也不申请真实权限。

- 登录方式与 Tuff 一致：Passkey、GitHub、LINUX DO 与邮箱 Magic Link，没有密码框；「离线继续」跳过工作区一步。
- 「继续」只在本步满足条件时可用，旁边写明还差什么；「上一步」与已完成的步骤都能回退，换步时焦点移到新步骤标题。
- 呼出快捷键可录制：组合须含 ⌘、⌃ 或 ⌥，Esc 取消；⌘W、⌘T 这类浏览器保留的组合会被拒绝。
- 每项权限都要你点「允许访问」；屏幕录制第一次被拒，行内给出「前往系统设置」。
- 进入视口时只播入场；「看一遍流程」自动走到权限页停下；点击或按键即停止；减少动态效果时直接跳到权限页。
- 完成页里按下呼出快捷键即唤起迷你 CoreBox；≥ 1200px 右侧出现实时预览，窄屏（< 640px）品牌栏收成顶部一行。

## 自定义

- 接真实登录时，把 `signIn()` 里的计时器换成 OAuth 跳转或 WebAuthn 调用；不要加密码框，Tuff 本就没有密码登录。
- 接真实权限时，状态从系统读取，「允许访问」触发系统弹窗后重新检查；授权只由用户点击触发。
- 入场特效（TxTuffLogoStroke 的 `once`、TxKeyframeStrokeText、TxGlowText 的 `:repeat="false"`）挂载即播：等可见时再挂载，换 `key` 重播。
- TxBorderBeam 的旋转家族（`sm`、`md`、`line`）没有减弱动态效果兜底，此时传 `:active="false"`；`theme` 默认 `dark`，`auto` 跟随系统而非站点，要显式传站点主题。
- TxSteps 没有 emit：回退要在 TxStep 上挂原生 `@click`，并只给已完成的步骤 `clickable`。

## 相关组件

| 区域 | 组件 | 作用 |
|---|---|---|
| 品牌栏 | [TxTuffLogoStroke](./tuff-logo-stroke.md)、[TxKeyframeStrokeText](./keyframe-stroke-text.md)、[TxGlowText](./glow-text.md) | 入场描边与扫光 |
| 步骤 | [TxSteps / TxStep](./steps.md)、[TxProgressBar](./progress-bar.md) | 五步进度，可回退 |
| 登录 | [TxBorderBeam](./border-beam.md)、[TxButton](./button.md)、[TxBadge](./badge.md)、[TxForm / TxFormItem](./form.md)、[TxInput](./input.md) | 四种登录方式与离线继续 |
| 工作区 | [TxRadioGroup / TxRadio](./radio.md)、[TxFlatRadio](./flat-radio.md)、[TxAvatar](./avatar.md)、[TxTagInput](./tag-input.md)、[TxCard](./card.md) | 创建个人空间或接受邀请 |
| 偏好 | [TxKbd](./kbd.md)、[TxGradientBorder](./gradient-border.md)、[TxFlatRadio](./flat-radio.md)、[TxRadioGroup / TxRadio](./radio.md)、[TuffSwitch](./switch.md) | 快捷键、主题与启动选项 |
| 权限 | [TxIconChip](./icon-chip.md)、[TxTag](./tag.md)、[TxStatusBadge](./status-badge.md)、[TxProgressBar](./progress-bar.md) | 三项权限及其状态 |
| 完成 | [TxKeyframeStrokeText](./keyframe-stroke-text.md)、[TxGlowText](./glow-text.md)、[TxKbd](./kbd.md)、[TxBorderBeam](./border-beam.md)、[TxGlassSurface](./glass-surface.md)、[TxCardItem](./card-item.md) | 试按快捷键与设置摘要 |
| 切换与反馈 | [TxTransition](./transition.md)、[TxToastPanel](./toast-panel.md) | 步骤过渡与结果提示 |
| 实时预览（宽屏） | [TxGlassSurface](./glass-surface.md)、[TxStatusBadge](./status-badge.md) | 实时预览设置效果 |

## 离线完整示例源码

- [TemplateOnboardingDemo](../snapshot/apps/nexus/app/components/content/demos/TemplateOnboardingDemo.vue.txt)

## 离线类型与实现参考

本页是跨组件/概念说明；先按具体组件查询 catalog.json，再按 SOURCE 清单核对；不要从名称猜导出。

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
