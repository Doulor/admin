<script setup lang="ts">
import { computed } from "vue";
import { TxTag } from "@talex-touch/tuffex/tag";
import { DEPT_TONE_TEXT, deptTone } from "../lib/tone";
import type { DeptTone } from "../lib/types";

/** 部门或称号徽章：TxTag + 名字，颜色取所在部门的色调（SPEC §1），没有部门时用「无部门」的色调。 */
const props = withDefaults(defineProps<{ label: string; tone?: DeptTone | null; size?: "sm" | "md" }>(), { tone: "ink", size: "sm" });
const color = computed(() => DEPT_TONE_TEXT[deptTone(props.tone)]);
</script>

<template>
  <TxTag :label="label" :color="color" :size="size" variant="soft" />
</template>
