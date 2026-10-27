use crate::output::{emit, ErrorBody, ExitCode, Outcome};
use crate::token_store::{self, StoredToken};
use crate::ui::login_anim::{self, LoginAnimation};
use anyhow::{bail, Context, Result};
use serde::Deserialize;
use serde_json::{json, Value};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::time::{sleep, sleep_until, Instant};

const CLIENT_ID: &str = "geek-cli";
const SCOPE: &str = "openid profile forum apply competition repo";
const GRANT_TYPE: &str = "urn:ietf:params:oauth:grant-type:device_code";
/// spinner 刷新间隔，和真实的轮询间隔（服务端给的 `interval`，默认 5 秒）是两件事。
const SPIN_INTERVAL: Duration = Duration::from_millis(120);

#[derive(Deserialize)]
struct Grant {
    device_code: String,
    user_code: String,
    verification_uri: String,
    verification_uri_complete: String,
    expires_in: u64,
    interval: u64,
}

#[derive(Deserialize)]
struct TokenSuccess {
    access_token: String,
    scope: String,
    account_id: String,
}

#[derive(Deserialize, Default)]
struct OAuthError {
    #[serde(default)]
    error: String,
    #[serde(default)]
    interval: Option<u64>,
}

pub async fn run(origin: String, no_browser: bool, json: bool) -> i32 {
    let is_interactive = crate::output::interactive(json);
    let interactive = login_anim::pick(is_interactive);
    match perform(&origin, no_browser, !json && !is_interactive, interactive).await {
        Ok(outcome) => emit(&outcome, json, render),
        Err(error) => emit(
            &Outcome::err(
                ExitCode::Other,
                ErrorBody::new("login_failed", error.to_string()),
            ),
            json,
            render,
        ),
    }
}

async fn perform(
    origin: &str,
    no_browser: bool,
    plain_prompt: bool,
    mut animation: Box<dyn LoginAnimation>,
) -> Result<Outcome> {
    let client = reqwest::Client::builder()
        .user_agent(concat!("geek-cli/", env!("CARGO_PKG_VERSION")))
        .timeout(Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .context("无法创建 HTTP 客户端")?;

    let _ = animation.show_letters();
    let _ = animation.show_mascot();

    let grant = match request_code(&client, origin).await? {
        Ok(grant) => grant,
        Err(body) => return Ok(Outcome::err(ExitCode::Other, body)),
    };

    let _ = animation.begin_waiting(&grant.user_code, &grant.verification_uri);
    if plain_prompt {
        println!(
            "请在浏览器打开 {}，输入代码 {}",
            grant.verification_uri, grant.user_code
        );
    }
    if !no_browser {
        open_browser(&grant.verification_uri_complete);
    }

    let outcome = poll_until_done(&client, origin, &grant, animation.as_mut()).await;
    let _ = animation.end_waiting();

    let token = match outcome? {
        Ok(token) => token,
        Err(body) => return Ok(Outcome::err(ExitCode::Other, body)),
    };

    let obtained_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    token_store::save(
        origin,
        &StoredToken {
            access_token: token.access_token.clone(),
            scope: token.scope.clone(),
            obtained_at,
        },
    )
    .context("保存令牌失败")?;

    let profile = fetch_profile(&client, origin, &token.access_token).await;
    let _ = animation.show_welcome(
        profile.nickname.as_deref().unwrap_or("你"),
        profile.avatar_bytes.as_deref(),
    );

    Outcome::ok(&json!({
        "account_id": token.account_id,
        "scope": token.scope,
        "nickname": profile.nickname,
        "department": profile.department,
        "grade_label": profile.grade_label,
        "email_required": profile.email_required,
        "profile_required": profile.profile_required,
        "hint": profile.hint,
    }))
}

async fn request_code(client: &reqwest::Client, origin: &str) -> Result<Result<Grant, ErrorBody>> {
    let response = client
        .post(format!("{origin}/auth/device/code"))
        .form(&[("client_id", CLIENT_ID), ("scope", SCOPE)])
        .send()
        .await
        .context("无法连接登录服务")?;
    let status = response.status();
    let bytes = response.bytes().await.unwrap_or_default();
    if !status.is_success() {
        let error: OAuthError = serde_json::from_slice(&bytes).unwrap_or_default();
        return Ok(Err(ErrorBody::new(
            if error.error.is_empty() {
                "device_code_failed".into()
            } else {
                error.error
            },
            format!("申请登录码失败（HTTP {status}）"),
        )));
    }
    Ok(Ok(
        serde_json::from_slice(&bytes).context("登录码响应格式无效")?
    ))
}

/// 轮询服务端换令牌，期间每 120ms 推进一次 spinner；真实的轮询按服务端给的 `interval` 走，
/// 收到 `slow_down` 时把它调大（RFC 8628 §3.5）。Ctrl-C 或超过 `expires_in` 都会结束等待。
async fn poll_until_done(
    client: &reqwest::Client,
    origin: &str,
    grant: &Grant,
    animation: &mut dyn LoginAnimation,
) -> Result<Result<TokenSuccess, ErrorBody>> {
    let deadline = Instant::now() + Duration::from_secs(grant.expires_in);
    let mut interval = grant.interval.max(1);
    let interrupted = tokio::signal::ctrl_c();
    tokio::pin!(interrupted);

    let waiting = async {
        loop {
            let next_poll = Instant::now() + Duration::from_secs(interval);
            while Instant::now() < next_poll {
                sleep(SPIN_INTERVAL.min(next_poll.saturating_duration_since(Instant::now()))).await;
                let _ = animation.spin();
            }
            let response = client
                .post(format!("{origin}/auth/device/token"))
                .form(&[
                    ("grant_type", GRANT_TYPE),
                    ("device_code", grant.device_code.as_str()),
                    ("client_id", CLIENT_ID),
                ])
                .send()
                .await
                .context("无法连接登录服务")?;
            let status = response.status();
            let bytes = response.bytes().await.unwrap_or_default();
            if status.is_success() {
                return Ok(Ok(
                    serde_json::from_slice::<TokenSuccess>(&bytes).context("登录响应格式无效")?
                ));
            }
            let error: OAuthError = serde_json::from_slice(&bytes).unwrap_or_default();
            match error.error.as_str() {
                "authorization_pending" => continue,
                "slow_down" => {
                    interval = error
                        .interval
                        .filter(|next| *next > interval)
                        .unwrap_or(interval + 5);
                }
                "access_denied" => return Ok(Err(ErrorBody::new("access_denied", "登录被拒绝"))),
                "expired_token" => {
                    return Ok(Err(ErrorBody::new(
                        "expired_token",
                        "登录码已过期，请重新运行 geek login",
                    )))
                }
                other => {
                    return Ok(Err(ErrorBody::new(
                        if other.is_empty() {
                            "invalid_grant".into()
                        } else {
                            other.to_string()
                        },
                        "登录失败，请重新运行 geek login",
                    )))
                }
            }
        }
    };

    tokio::select! {
        biased;
        _ = &mut interrupted => bail!("已取消登录"),
        _ = sleep_until(deadline) => Ok(Err(ErrorBody::new("expired_token", "登录码已过期，请重新运行 geek login"))),
        result = waiting => result,
    }
}

/// 登录刚拿到的资料：昵称、部门、年级、头像都是给步骤 4 打招呼用的，邮箱或资料没补齐时只带
/// 旗子和 `hint`，不强求拿到昵称。
struct WelcomeProfile {
    nickname: Option<String>,
    department: Option<String>,
    grade_label: Option<String>,
    avatar_bytes: Option<Vec<u8>>,
    email_required: bool,
    profile_required: bool,
    /// 邮箱或资料没补齐时给的提示；都补齐了是 null。
    hint: Option<String>,
}

/// 登录成功后多拉一点资料给步骤 4 用。先读 `/auth/device/userinfo`（任何有效令牌都能用，带
/// `email_required`/`profile_required`，#280）；缺邮箱或资料时 `/api/console/me` 会被同一个关口
/// （bearer-auth.ts 的 `gateRefusal`）挡住，直接跳过，不发一个注定 403 的请求——降级成只打招呼
/// 不带资料，附上去哪补的提示，不影响登录本身。
async fn fetch_profile(client: &reqwest::Client, origin: &str, token: &str) -> WelcomeProfile {
    let userinfo: Option<Value> = match client
        .get(format!("{origin}/auth/device/userinfo"))
        .bearer_auth(token)
        .send()
        .await
    {
        Ok(response) if response.status().is_success() => response.json().await.ok(),
        _ => None,
    };
    let email_required = userinfo
        .as_ref()
        .and_then(|v| v.get("email_required"))
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let profile_required = userinfo
        .as_ref()
        .and_then(|v| v.get("profile_required"))
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let grade_label = userinfo
        .as_ref()
        .and_then(|v| v.get("grade_label"))
        .and_then(Value::as_str)
        .map(str::to_string);

    let mut nickname = None;
    let mut department = None;
    let mut avatar_bytes = None;
    if !email_required && !profile_required {
        let response = client
            .get(format!("{origin}/api/console/me"))
            .bearer_auth(token)
            .send()
            .await
            .ok();
        let me: Option<Value> = match response {
            Some(response) if response.status().is_success() => response.json().await.ok(),
            _ => None,
        };
        // 新账号还没填过资料时 display_name 是空字符串（服务端真实行为，不是没取到）：落到登录名，
        // 不要打招呼打出一个空昵称。
        nickname = me
            .as_ref()
            .and_then(|v| v.get("display_name"))
            .and_then(Value::as_str)
            .filter(|name| !name.trim().is_empty())
            .or_else(|| {
                me.as_ref()
                    .and_then(|v| v.get("login"))
                    .and_then(Value::as_str)
            })
            .map(str::to_string);
        department = me
            .as_ref()
            .and_then(|v| v.get("department"))
            .and_then(|d| d.get("name"))
            .and_then(Value::as_str)
            .map(str::to_string);
        let avatar_url = me
            .as_ref()
            .and_then(|v| v.get("avatar_url"))
            .and_then(Value::as_str)
            .filter(|url| !url.is_empty());
        avatar_bytes = match avatar_url {
            Some(url) => match client.get(url).send().await {
                Ok(response) if response.status().is_success() => {
                    response.bytes().await.ok().map(|bytes| bytes.to_vec())
                }
                _ => None,
            },
            None => None,
        };
    }

    let gate_code = if email_required {
        Some("email_required")
    } else if profile_required {
        Some("profile_required")
    } else {
        None
    };
    let hint = gate_code.and_then(|code| crate::api::gate_message(origin, code));

    WelcomeProfile {
        nickname,
        department,
        grade_label,
        avatar_bytes,
        email_required,
        profile_required,
        hint,
    }
}

fn open_browser(url: &str) {
    #[cfg(target_os = "macos")]
    let _ = std::process::Command::new("open").arg(url).spawn();
    #[cfg(target_os = "linux")]
    let _ = std::process::Command::new("xdg-open").arg(url).spawn();
    #[cfg(target_os = "windows")]
    let _ = std::process::Command::new("rundll32.exe")
        .arg("url.dll,FileProtocolHandler")
        .arg(url)
        .spawn();
}

fn render(data: &Value) {
    if let Some(nickname) = data.get("nickname").and_then(Value::as_str) {
        println!("欢迎回来，{nickname}");
    } else {
        println!("登录成功。");
    }
    if let Some(hint) = data.get("hint").and_then(Value::as_str) {
        println!("{hint}");
    }
}
