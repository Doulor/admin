import { describe, expect, it } from 'vitest'
import { signinOutcomes } from '../shared/signin-outcomes'

describe('signinOutcomes', () => {
  it('does not promise readable posts on the 极客班 site build, which has none yet', () => {
    expect(signinOutcomes({ hasPosts: false }).account_disabled?.description).toBe('有疑问请联系站长。')
    expect(signinOutcomes({ hasPosts: true }).account_disabled?.description).toBe('有疑问请联系站长。不登录也能看帖子。')
  })

  it('keeps the other outcomes identical in both modes', () => {
    const site = signinOutcomes({ hasPosts: false })
    const other = signinOutcomes({ hasPosts: true })
    for (const reason of ['invite_invalid', 'email_taken', 'code_expired', 'no_account', 'rate_limited', 'cancelled', 'failed'])
      expect(site[reason]).toEqual(other[reason])
  })

  it('no longer lists the GitHub-organisation reasons #274 removed', () => {
    const outcomes = signinOutcomes({ hasPosts: true })
    expect(outcomes.not_member).toBeUndefined()
    expect(outcomes.invite_pending).toBeUndefined()
  })
})
