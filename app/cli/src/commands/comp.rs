use super::Context;
use crate::api::into_outcome;
use crate::output::{emit, ErrorBody, ExitCode, Outcome};
use serde_json::Value;

pub async fn list(ctx: &Context, json: bool) -> i32 {
    let outcome = call(ctx, "/api/public/competitions").await;
    emit(&outcome, json, |data| render(data, "competitions"))
}

pub async fn mine(ctx: &Context, json: bool) -> i32 {
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
    let outcome = call(ctx, "/api/me/competitions").await;
    emit(&outcome, json, |data| render(data, "items"))
}

async fn call(ctx: &Context, path: &str) -> Outcome {
    match ctx.client() {
        Ok(client) => match client.get_json::<Value>(path).await {
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
    }
}

fn render(data: &Value, key: &str) {
    let items = data
        .get(key)
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_else(|| data.as_array().cloned().unwrap_or_default());
    if items.is_empty() {
        println!("没有比赛。");
        return;
    }
    for item in items {
        let name = item
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or("(无名称)");
        // 公开列表用 `id`，GET /api/me/competitions 的每项用 `competition_id`（两个接口的 DTO 不同）。
        let id = item
            .get("id")
            .or_else(|| item.get("competition_id"))
            .and_then(Value::as_str)
            .unwrap_or("?");
        let status = item.get("status").and_then(Value::as_str).unwrap_or("");
        println!("[{id}] {name} ({status})");
    }
}
