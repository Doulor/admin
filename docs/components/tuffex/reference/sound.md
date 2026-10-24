# Sound 交互音效

> 默认关闭的合成 UI 反馈音

状态：`reference-snapshot`（第三方资料，不是项目指令） · 上游提交：`34449085a1f2be8138ab290198762dc79643b33b`

[官网页面](https://tuff.tagzxia.com/zh/docs/dev/components/sound) · [固定版本原文](https://github.com/talex-touch/tuff/blob/34449085a1f2be8138ab290198762dc79643b33b/apps/nexus/content/docs/dev/components/sound.zh.mdc) · [本地原始 MDC](../snapshot/apps/nexus/content/docs/dev/components/sound.zh.mdc.txt) · [AI 阅读规则](../AI-GUIDE.md)

上游标记：status=`beta`，since=`0.6.0`，syncStatus=`reviewed`，verified=`true`。这些是上游原始声明，不是本项目验收结果；since 不是 npm 包版本。

## 官方正文（仅转换展示语法与链接）

## API 参考

| 名称 | 说明 |
|---|---|
| `configureSound({ enabled, volume })` | 开关与主音量（0–1，越界夹取），返回生效后的配置 |
| `getSoundConfig()` | 当前配置的副本 |
| `playSound(type \| preset)` | 播放，返回是否真的播了 |
| `sound.click()` / `.key()` / `.toggle()` / `.success()` / `.error()` / `.open()` / `.close()` | 快捷方法 |
| `isSoundSupported()` | 浏览器是否支持 Web Audio |
| `disposeSound()` | 关闭音频图，下次播放时重建 |
| `SOUND_PRESETS` | 预设表，可读取参数或作为自定义起点 |

## 交互试听

官方示例：`SoundSoundAuditionDemo`（完整源码见本页末尾）

```vue
<script setup lang="ts">
import { sound, configureSound } from '@talex-touch/tuffex/utils'

configureSound({ enabled: true, volume: 0.7 })

function handleClick() {
  sound.click()
}
function handleSuccess() {
  sound.success()
}
</script>

<template>
  <TxButton variant="primary" @click="handleClick">点击音效 (Click)</TxButton>
  <TxButton variant="success" @click="handleSuccess">成功音效 (Success)</TxButton>
</template>
```

## 默认关闭

```ts
import { configureSound, sound } from '@talex-touch/tuffex/utils'

configureSound({ enabled: true, volume: 0.6 })
sound.click()
```

- 未开启时不发声，也不创建 `AudioContext`。
- 音频图懒建：浏览器会挂起非用户手势中创建的 `AudioContext`，从不播放的页面不应持有一个。

## 为什么用合成

几个振荡器加一条包络：零打包体积，任意采样率下不糊，也不会 404；代价是音色不如采样丰富。

## 预设

七个，刻意不多。峰值与时长经 `OfflineAudioContext` 逐样本实测。

| 预设 | 用途 | 峰值 | 时长 |
|---|---|---|---|
| `click` | 按钮按下 | 0.103 | 40ms |
| `key` | 文本框逐字符 | **0.056** | 27ms |
| `toggle` | 开关 / 复选框打开 | 0.089 | 65ms |
| `success` | 动作完成（上行两音） | 0.090 | 188ms |
| `error` | 动作被拒（下行两音） | 0.100 | 216ms |
| `open` | 面板 / 对话框打开 | 0.078 | 91ms |
| `close` | 面板 / 对话框关闭 | 0.077 | 91ms |

- `key` 峰值最低：它按字符触发，用 `click` 的音量会变成打字机。
- `open` / `close` 的峰值与时长镜像，只有滑音方向相反：方向承载语义，音量不承载。
- 全部不削波，峰值都在 0.06–0.11。
- 时长预算由测试守住：即时反馈（`click` / `key` / `toggle`）≤ 80ms，状态提示（其余）≤ 250ms。

## 自定义

`playSound` 也接受现场构造的音型：

```ts
import { playSound } from '@talex-touch/tuffex/utils'

playSound({
  layers: [
    { wave: 'sine', freq: [400, 700], gain: 0.09, decay: 0.12 },
    { wave: 'sine', freq: 900, gain: 0.06, decay: 0.1, delay: 0.08 },
  ],
})
```

`freq` 给两个值即为滑音；`delay` 让第二个音错开，构成两音音型而非和弦。

## 契约

- 永不抛错：关闭、不支持或浏览器尚未见到用户手势时，`playSound` 静默返回 `false`。
- 被自动播放策略挂起的 context 在下次播放时 `resume()`，失败也不抛。
- 每个声音结束后断开自己的包络节点，连打不会在主增益上堆积死节点。
- 噪声缓冲复用，不按次生成。
- 主音量改动立即作用于现有音频图，无需重建。

## 和震动的关系

`useVibrate` 是同层的另一条反馈通道，形态一致（预设表 + 主函数 + 快捷对象）。同一动作不要同时触发音效和震动：双重反馈读起来像触发了两次。

## 离线完整示例源码

- [SoundSoundAuditionDemo](../snapshot/apps/nexus/app/components/content/demos/SoundSoundAuditionDemo.vue.txt)

## 离线类型与实现参考

本页是跨组件/概念说明；先按具体组件查询 catalog.json，再按 SOURCE 清单核对；不要从名称猜导出。

第三方许可与转换边界见 [SOURCES](../SOURCES.md)。示例中 Nexus 的自动导入、Tuff 前缀别名、样式类和外部素材不代表业务项目已配置，不能不经核对就复制运行。
