use super::Context;
use crate::api::into_outcome;
use crate::output::{emit, ErrorBody, ExitCode, Outcome};
use serde_json::Value;

/// `GET /api/me/applications`（#277）：按登录邮箱匹配招新表的投递记录，不绑邮箱的账号是空列表；
/// 只回 id、status、created_at，服务端本来就不给姓名、班级、邮箱、特长（命令行拿不到这些）。
pub async fn status(ctx: &Context, json: bool) -> i32 {
    if ctx.token.is_none() {
        return emit(
            &Outcome::err(
                ExitCode::NotSignedIn,
                ErrorBody::new("not_signed_in", "还没有登录，先运行 geek login"),
            ),
            json,
            |_| {},
        );
    }
    let outcome = match ctx.client() {
        Ok(client) => match client.get_json::<Value>("/api/me/applications").await {
            Ok(outcome) => into_outcome(&ctx.origin, outcome),
            Err(error) => Outcome::err(
                ExitCode::Network,
                ErrorBody::new("network_error", error.to_string()),
            ),
        },
        Err(error) => Outcome::err(
            ExitCode::Other,
            ErrorBody::new("client_error", error.to_string()),
        ),
    };
    emit(&outcome, json, render)
}

fn render(data: &Value) {
    let items = data
        .get("applications")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    if items.is_empty() {
        println!("没有投递记录（也可能是账号还没绑定投递时用的邮箱）。");
        return;
    }
    for item in items {
        let id = item.get("id").and_then(Value::as_str).unwrap_or("?");
        let status = item.get("status").and_then(Value::as_str).unwrap_or("?");
        println!("[{id}] {status}");
    }
}
