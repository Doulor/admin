# 追加到 Arch /srv/gitlab/config/gitlab.rb 末尾（2026-10-23 已追加，原文件备份为 gitlab.rb.bak-20261023-oidc）。
# secret 不在这里：Arch /srv/gitlab/config/yzgc-oidc-secret（root 0600，容器里是 /etc/gitlab/yzgc-oidc-secret），值在本机凭据库 GITLAB_OIDC_CLIENT_SECRET。

### 极客班统一登录（#270）：2026-10-23 加。正式站上线前接预发布的签发者；secret 在同目录 root 0600 的 yzgc-oidc-secret，不进仓库。
gitlab_rails['omniauth_enabled'] = true
gitlab_rails['omniauth_allow_single_sign_on'] = ['openid_connect']
gitlab_rails['omniauth_block_auto_created_users'] = false
gitlab_rails['omniauth_sync_profile_from_provider'] = ['openid_connect']
gitlab_rails['omniauth_sync_profile_attributes'] = ['name']
gitlab_rails['omniauth_providers'] = [{
  name: 'openid_connect', label: '极客班统一登录',
  args: {
    name: 'openid_connect', scope: ['openid', 'profile', 'email'], response_type: 'code',
    issuer: 'https://prev.yangtzeu.work/oidc', discovery: true, client_auth_method: 'basic', uid_field: 'sub', pkce: true,
    client_options: { identifier: 'gitlab', secret: File.read('/etc/gitlab/yzgc-oidc-secret').strip,
                      redirect_uri: 'https://git.yangtzeu.work/users/auth/openid_connect/callback' },
  },
}]
# 登录页直接跳到极客班统一登录；root 应急用 /users/sign_in?auto_sign_in=false 走密码
gitlab_rails['omniauth_auto_sign_in_with_provider'] = 'openid_connect'
