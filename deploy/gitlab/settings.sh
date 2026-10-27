#!/usr/bin/env bash
# 首次启动后的应用设置（这些项不在 gitlab.rb 里，存在数据库的 application_settings）：
# 关注册、制品 7 天过期、只开 HTTPS 克隆（SSH 端口不对外）、站点标题。可重复执行。
set -Eeuo pipefail

docker exec -i gitlab gitlab-rails runner - <<'RUBY'
s = ApplicationSetting.current
s.update!(
  signup_enabled: false,
  default_artifacts_expire_in: '7 days',
  enabled_git_access_protocol: 'http',
  usage_ping_enabled: false
)
a = Appearance.current || Appearance.new
a.update!(title: '长江大学极客班 代码仓库')
puts({
  signup_enabled: s.signup_enabled,
  default_artifacts_expire_in: s.default_artifacts_expire_in,
  enabled_git_access_protocol: s.enabled_git_access_protocol,
  appearance_title: a.title
}.to_json)
RUBY
