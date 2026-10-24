/**
 * 登录没成功的原因 `?signin=<原因>`。#262 起核心服务把它带到统一登录页 /signin 说明（见 app/server/src/routes/admin/auth.ts），
 * 论坛只在旧链接里还带着它时按这里的文案提示一次。论坛里一篇帖子都没有时（极客班论坛没有公开任何旧帖），不说「不登录也能看帖子」。
 * #274 review round 1：邀请码改成选填，组织那道门已经去掉，`not_member`、`invite_pending` 这两个原因服务端不会
 * 再发了（lib/safe-return.ts 的 SigninOutcome），换成现在真的会发的几种（SigninRefusal）。
 */
export interface SigninOutcome { title: string, description: string, variant: 'info' | 'warning' }

export function signinOutcomes(options: { hasPosts: boolean }): Record<string, SigninOutcome> {
  return {
    account_disabled: {
      title: '这个极客班账号已停用',
      description: options.hasPosts ? '有疑问请联系站长。不登录也能看帖子。' : '有疑问请联系站长。',
      variant: 'warning',
    },
    invite_invalid: { title: '邀请码无效', description: '不填邀请码也能注册成注册用户，再登录一次就行。', variant: 'warning' },
    email_taken: { title: '这个邮箱已经绑定了别的账号', description: '换一个邮箱，或者用已绑定的那个账号登录。', variant: 'warning' },
    code_expired: { title: '验证码已失效', description: '请重新获取验证码再试。', variant: 'warning' },
    no_account: { title: '这个邮箱还没有极客班账号', description: '先用验证码登录注册一个。', variant: 'warning' },
    rate_limited: { title: '试得太频繁了', description: '请稍后再试。', variant: 'warning' },
    cancelled: { title: '已取消登录', description: '需要时再点右上角的登录。', variant: 'info' },
    failed: { title: '登录没有完成', description: '请稍后再试一次。', variant: 'warning' },
  }
}
