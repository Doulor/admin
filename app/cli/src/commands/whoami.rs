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
    /// 年级（「大二」「已毕业」之类），服务端按入学年份现算；没补过资料时是 null。真实姓名不在这
    /// 结构里——命令行拿不到任何账号的 real_name，哪怕是本人（#277 的硬约束）。
    grade_label: Option<String>,
    scope: String,
    email_required: bool,
    profile_required: bool,
    /// 邮箱或资料没补齐时给的提示，办好后 `hint` 就是 null；成功与否仍然是退出码 0，
    /// 不是本来就该失败的调用。
    hint: Option<String>,
}

/// `GET /auth/device/userinfo` 对任何有效令牌都能用，带 `email_required`/`profile_required`
/// （#280）；`GET /api/console/me` 多给昵称与部门，但账号没绑邮箱或没补资料时会被同一个关口
/// （bearer-auth.ts 的 `gateRefusal`）挡住——这两种情况直接按 userinfo 的旗子跳过，不发一个
/// 注定 403 的请求。
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
    let grade_label = user
        .get("grade_label")
        .and_then(Value::as_str)
        .map(str::to_string);
    let email_required = user
        .get("email_required")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let profile_required = user
        .get("profile_required")
        .and_then(Value::as_bool)
        .unwrap_or(false);

    let mut nickname = None;
    let mut department = None;
    if !email_required && !profile_required {
        if let Ok(crate::api::ApiOutcome::Ok(me)) =
            client.get_json::<Value>("/api/console/me").await
        {
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
    }
    let gate_code = if email_required {
        Some("email_required")
    } else if profile_required {
        Some("profile_required")
    } else {
        None
    };
    let hint = gate_code.and_then(|code| crate::api::gate_message(&ctx.origin, code));

    Outcome::ok(&Whoami {
        account_id,
        login,
        nickname,
        avatar_url,
        department,
        grade_label,
        scope,
        email_required,
        profile_required,
        hint,
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
    let grade_label = data.get("grade_label").and_then(Value::as_str);
    println!("登录名：{login}");
    if let Some(nickname) = nickname {
        println!("昵称：{nickname}");
    }
    if let Some(department) = department {
        println!("部门：{department}");
    }
    if let Some(grade_label) = grade_label {
        println!("年级：{grade_label}");
    }
    if let Some(hint) = data.get("hint").and_then(Value::as_str) {
        println!("{hint}");
    }
}
