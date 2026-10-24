use super::Context;
use crate::output::{emit, Outcome};
use crate::token_store::TokenSource;
use serde::Serialize;
use serde_json::Value;
use std::time::Duration;

/// `geek status`（#277）：本机登录状态，不是业务查询，不要求已登录——没登录也要能看出「没登录」
/// 和「服务端连不连得上」，所以始终成功（退出码 0），用字段说明情况，不用错误体。
#[derive(Serialize)]
struct Status {
    origin: String,
    version: &'static str,
    signed_in: bool,
    /// 令牌来自哪一层；没登录时是 null。不含令牌本身。
    token_source: Option<&'static str>,
    server_reachable: bool,
    /// 有令牌时才去查；没登录、网络错误或令牌已失效时都是 false。
    token_valid: bool,
    /// 令牌有效时顺带读到的两道闸状态；没登录或令牌无效时是 null（不是「没有」，是「不知道」）。
    email_required: Option<bool>,
    profile_required: Option<bool>,
    /// 两道闸挡住了业务接口时的提示；都没挡住，或没法判断时是 null。
    hint: Option<String>,
}

pub async fn run(ctx: &Context, json: bool) -> i32 {
    let server_reachable = probe_health(&ctx.origin).await;
    let userinfo = match &ctx.token {
        Some(_) => probe_token(ctx).await,
        None => None,
    };
    let email_required = userinfo
        .as_ref()
        .and_then(|info| info.get("email_required"))
        .and_then(Value::as_bool);
    let profile_required = userinfo
        .as_ref()
        .and_then(|info| info.get("profile_required"))
        .and_then(Value::as_bool);
    let gate_code = if email_required == Some(true) {
        Some("email_required")
    } else if profile_required == Some(true) {
        Some("profile_required")
    } else {
        None
    };
    let status = Status {
        origin: ctx.origin.clone(),
        version: env!("CARGO_PKG_VERSION"),
        signed_in: ctx.token.is_some(),
        token_source: ctx.token_source.map(TokenSource::label),
        server_reachable,
        token_valid: userinfo.is_some(),
        email_required,
        profile_required,
        hint: gate_code.and_then(|code| crate::api::gate_message(&ctx.origin, code)),
    };
    let outcome = Outcome::ok(&status).expect("Status 总能序列化");
    emit(&outcome, json, render)
}

/// `GET /healthz`：不带 Authorization 头（带了会撞上 bearer-auth.ts 的默认拒绝，它不在命令行能用的
/// 接口列表里），公开探活接口，和登录状态无关。
async fn probe_health(origin: &str) -> bool {
    let client = match reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
    {
        Ok(client) => client,
        Err(_) => return false,
    };
    matches!(
        client.get(format!("{origin}/healthz")).send().await,
        Ok(response) if response.status().is_success()
    )
}

/// `GET /auth/device/userinfo`：命令行令牌永远能用的两个接口之一；200 时把整份响应（含
/// `email_required`/`profile_required`/`grade_label`）带回去，401 或网络错误都是 None（令牌无效）。
async fn probe_token(ctx: &Context) -> Option<Value> {
    let client = ctx.client().ok()?;
    match client.get_json::<Value>("/auth/device/userinfo").await {
        Ok(crate::api::ApiOutcome::Ok(value)) => Some(value),
        _ => None,
    }
}

fn render(data: &Value) {
    let origin = data.get("origin").and_then(Value::as_str).unwrap_or("?");
    let version = data.get("version").and_then(Value::as_str).unwrap_or("?");
    let reachable = data
        .get("server_reachable")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    println!("源站：{origin}");
    println!("版本：{version}");
    println!(
        "服务端：{}",
        if reachable {
            "可以连上"
        } else {
            "连不上"
        }
    );
    let signed_in = data
        .get("signed_in")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    if !signed_in {
        println!("登录状态：还没有登录，运行 geek login");
        return;
    }
    let source = data
        .get("token_source")
        .and_then(Value::as_str)
        .unwrap_or("?");
    let valid = data
        .get("token_valid")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    println!("登录状态：已登录（令牌来自 {source}）");
    println!(
        "令牌：{}",
        if valid {
            "有效"
        } else {
            "已失效，请重新 geek login"
        }
    );
    if let Some(hint) = data.get("hint").and_then(Value::as_str) {
        println!("{hint}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample(signed_in: bool, token_valid: bool) -> Status {
        Status {
            origin: "https://example.test".into(),
            version: "0.1.0",
            signed_in,
            token_source: signed_in.then(|| TokenSource::Keyring.label()),
            server_reachable: true,
            token_valid,
            email_required: token_valid.then_some(false),
            profile_required: token_valid.then_some(false),
            hint: None,
        }
    }

    #[test]
    fn status_serializes_without_the_token_itself() {
        let value = serde_json::to_value(sample(true, true)).unwrap();
        assert_eq!(value["origin"], "https://example.test");
        assert_eq!(value["signed_in"], true);
        assert_eq!(value["token_source"], "系统钥匙串");
        assert_eq!(value["server_reachable"], true);
        assert_eq!(value["token_valid"], true);
        // 字段里不含 access_token、token 这类名字：序列化出来的 JSON 不可能带上令牌本身。
        let text = serde_json::to_string(&value).unwrap();
        assert!(!text.contains("token\":\"") && !text.contains("access_token"));
    }

    #[test]
    fn status_without_a_token_never_reports_it_valid_and_gates_are_unknown() {
        let value = serde_json::to_value(sample(false, false)).unwrap();
        assert_eq!(value["token_source"], Value::Null);
        assert_eq!(value["token_valid"], false);
        assert_eq!(value["email_required"], Value::Null);
        assert_eq!(value["profile_required"], Value::Null);
    }
}
