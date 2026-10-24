<script setup lang="ts">
import { computed } from "vue";
import { TxTag } from "@talex-touch/tuffex/tag";
import { toneColor } from "../lib/tone";
import type { Tone } from "../lib/types";

/** 状态标签：带色点的 TxTag，色调固定（lib/tone.ts），与称号/部门徽章用的色调是另一套取值。 */
const props = withDefaults(defineProps<{ tone: Tone; label: string; icon?: string; dot?: boolean }>(), { icon: "", dot: true });
const color = computed(() => toneColor(props.tone));
</script>

<template>
  <TxTag :label="label" :icon="icon" :color="color" :dot="dot ? color : undefined" variant="soft" />
</template>
