<script setup lang="ts">
import type { User } from '~/data/types'
import { accountBadges, hasAccountTitles } from '~/data/account-badges'
import { DEFAULT_ORG, titleColor, titleIcon, titleLabel } from '~/data/titles'

/**
 * A user's titles as TxTags beside the name.
 *
 * Against the forum server (#276 CONTRACT §9) the user carries the account's
 * titles and department, named by the admins in the console: one tag per
 * title in its department's tone, or the department alone, or nothing
 * (data/account-badges.ts). Department tones come from
 * `/api/public/departments` through `useOrgTitles`.
 *
 * The demo seed and the local snapshot have no such fields; their users keep
 * the upstream title (`user.title`) drawn from app/data/titles.ts.
 *
 * No click listener on purpose: TxTag becomes a `role="button"` tab stop as
 * soon as it has one, and a title is metadata, not a control.
 */
const props = withDefaults(defineProps<{
  user: Pick<User, 'title' | 'titles' | 'department'>
  size?: 'sm' | 'md'
}>(), {
  size: 'sm',
})

// The legacy palette hexes are tuned for the light surface; under `html.dark`
// `titleColor` lifts them toward Tuffex's own ink token.
const colorMode = useColorMode()
const dark = computed(() => colorMode.value === 'dark')
const departments = useOrgTitles()

const badges = computed(() => {
  if (hasAccountTitles(props.user))
    return accountBadges(props.user, departments.value).map(badge => ({ ...badge, icon: undefined as string | undefined }))
  const title = props.user.title
  if (!title)
    return []
  return [{ key: title.id, label: titleLabel(title, DEFAULT_ORG), icon: titleIcon(title, DEFAULT_ORG), color: titleColor(title, dark.value, DEFAULT_ORG) }]
})
</script>

<template>
  <TxTag
    v-for="badge in badges"
    :key="badge.key"
    :label="badge.label"
    :icon="badge.icon"
    :color="badge.color"
    :size="size"
  />
</template>
