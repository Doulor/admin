use super::Context;
use crate::output::{emit, ErrorBody, ExitCode, Outcome};
use serde::Serialize;
use serde_json::Value;

#[derive(Serialize)]
struct Whoami {
    account_id: String,
    login: String,
    nickname: Option<String>,
    avatar_url: Option<String>,
    department: Option<String>,
    scope: String,
}

/// `GET /auth/device/userinfo` 对任何有效令牌都能用；`GET /api/console/me` 多给昵称与部门，
/// 但账号没绑邮箱时会被 #277 的邮箱闸挡住——降级为只用 userinfo 的字段，不让 whoami 因此失败。
pub async fn run(ctx: &Context, json: bool) -> i32 {
    let outcome = match &ctx.token {
        None => Outcome::err(
            ExitCode::NotSignedIn,
            ErrorBody::new("not_signed_in", "还没有登录，先运行 geek login"),
        ),
        Some(_) => build(ctx).await,
    };
    emit(&outcome, json, render)
}

async fn build(ctx: &Context) -> Outcome {
    let client = match ctx.client() {
        Ok(client) => client,
        Err(error) => {
            return Outcome::err(
                ExitCode::Other,
                ErrorBody::new("client_error", error.to_string()),
            )
        }
    };
    let userinfo: crate::api::ApiOutcome<Value> =
        match client.get_json("/auth/device/userinfo").await {
            Ok(outcome) => outcome,
            Err(error) => {
                return Outcome::err(
                    ExitCode::Network,
                    ErrorBody::new("network_error", error.to_string()),
                )
            }
        };
    let user = match userinfo {
        crate::api::ApiOutcome::Ok(value) => value,
        crate::api::ApiOutcome::Err(code, body) => return Outcome::err(code, body),
    };
    let account_id = user
        .get("account_id")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let login = user
        .get("login")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let avatar_url = user
        .get("avatar_url")
        .and_then(Value::as_str)
        .map(str::to_string);
    let scope = user
        .get("scope")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();

    let mut nickname = None;
    let mut department = None;
    if let Ok(crate::api::ApiOutcome::Ok(me)) = client.get_json::<Value>("/api/console/me").await {
        // 新账号还没填过资料时 display_name 是空字符串（服务端真实行为）：落到登录名。
        nickname = me
            .get("display_name")
            .and_then(Value::as_str)
            .filter(|name| !name.trim().is_empty())
            .map(str::to_string)
            .or_else(|| {
                if login.is_empty() {
                    None
                } else {
                    Some(login.clone())
                }
            });
        department = me
            .get("department")
            .and_then(|value| value.get("name"))
            .and_then(Value::as_str)
            .map(str::to_string);
    }

    Outcome::ok(&Whoami {
        account_id,
        login,
        nickname,
        avatar_url,
        department,
        scope,
    })
    .unwrap_or_else(|error| {
        Outcome::err(
            ExitCode::Other,
            ErrorBody::new("serialize_error", error.to_string()),
        )
    })
}

fn render(data: &Value) {
    let login = data.get("login").and_then(Value::as_str).unwrap_or("?");
    let nickname = data.get("nickname").and_then(Value::as_str);
    let department = data.get("department").and_then(Value::as_str);
    println!("登录名：{login}");
    if let Some(nickname) = nickname {
        println!("昵称：{nickname}");
    }
    if let Some(department) = department {
        println!("部门：{department}");
    }
}
