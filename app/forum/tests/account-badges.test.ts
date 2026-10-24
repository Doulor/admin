import type { User } from '~/data/types'
import { describe, expect, it } from 'vitest'
import { accountBadges, DEPARTMENT_TONE_COLORS, hasTitleBadge, parsePublicDepartments } from '~/data/account-badges'

/**
 * The tags next to an account (#276): the server's titles, coloured by their
 * department's tone; the department alone when there is no title; nothing for
 * 无部门. Demo users keep the old `title`.
 */
const ai = { id: 'dept.ai', name: 'AI 部', tone: 'c' }

describe('accountBadges', () => {
  it('gives each title a tag in its department\'s colour', () => {
    const badges = accountBadges({ department: ai, titles: [{ id: 'title.ai.lead', name: '部长', department_id: 'dept.ai' }] })
    expect(badges).toEqual([{ key: 'title.ai.lead', label: '部长', color: DEPARTMENT_TONE_COLORS.c }])
  })

  it('takes the colour of a title from another department from the public list', () => {
    const departments = new Map([['dept.hw', { id: 'dept.hw', name: '硬件部', tone: 'g' }]])
    const badges = accountBadges({ department: ai, titles: [{ id: 'title.hw.member', name: '成员', department_id: 'dept.hw' }] }, departments)
    expect(badges[0]?.color).toBe(DEPARTMENT_TONE_COLORS.g)
  })

  it('falls back to ink for an unknown tone or department', () => {
    expect(accountBadges({ department: null, titles: [{ id: 't', name: '顾问', department_id: null }] })[0]?.color).toBe(DEPARTMENT_TONE_COLORS.ink)
    expect(accountBadges({ department: { id: 'dept.x', name: '新部门', tone: 'unknown' }, titles: [] })[0]?.color).toBe(DEPARTMENT_TONE_COLORS.ink)
  })

  it('shows the department alone when there is no title, and nothing for 无部门', () => {
    expect(accountBadges({ department: ai, titles: [] })).toEqual([{ key: 'dept.ai', label: 'AI 部', color: DEPARTMENT_TONE_COLORS.c }])
    expect(accountBadges({ department: { id: 'dept.none', name: '无部门', tone: 'ink' }, titles: [] })).toEqual([])
    expect(accountBadges({ department: null, titles: [] })).toEqual([])
  })
})

describe('hasTitleBadge', () => {
  it('reads the server\'s titles when the user has them, the old title otherwise', () => {
    const legacy: NonNullable<User['title']> = { id: 'member' }
    expect(hasTitleBadge({ titles: [], department: null, title: legacy })).toBe(false)
    expect(hasTitleBadge({ titles: [], department: ai })).toBe(true)
    expect(hasTitleBadge({ title: legacy })).toBe(true)
    expect(hasTitleBadge({})).toBe(false)
  })
})

describe('parsePublicDepartments', () => {
  it('keeps id, name and tone, and skips entries of the wrong shape', () => {
    const map = parsePublicDepartments({ departments: [{ ...ai, icon: null, titles: [] }, { id: 'dept.none', name: '无部门' }, { id: 3 }, null] })
    expect([...map.values()]).toEqual([ai, { id: 'dept.none', name: '无部门', tone: null }])
    expect(parsePublicDepartments({}).size).toBe(0)
    expect(parsePublicDepartments(null).size).toBe(0)
  })
})
