use super::Context;
use crate::api::into_outcome;
use crate::output::{emit, ErrorBody, ExitCode, Outcome};
use serde_json::{json, Value};

pub async fn list(ctx: &Context, json: bool) -> i32 {
    let outcome = call(ctx, "/api/public/competitions").await;
    emit(&outcome, json, |data| render(data, "competitions"))
}

/// `GET /api/public/competitions/:id`：公开接口，不需要登录。
pub async fn show(ctx: &Context, id: String, json: bool) -> i32 {
    let outcome = call(ctx, &format!("/api/public/competitions/{id}")).await;
    emit(&outcome, json, render_one)
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

/// 报名请求体：抽成纯函数方便单测，不用真的发请求就能核对字段名。
fn signup_body(note: &str, looking_for_team: bool) -> Value {
    json!({ "note": note, "looking_for_team": looking_for_team })
}

/// `POST /api/competitions/:id/signup`：需要 `competition.signup` 权限节点（注册用户默认没有）。
pub async fn signup(
    ctx: &Context,
    id: String,
    note: String,
    looking_for_team: bool,
    json: bool,
) -> i32 {
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
    let outcome = post_call(
        ctx,
        &format!("/api/competitions/{id}/signup"),
        &signup_body(&note, looking_for_team),
    )
    .await;
    emit(&outcome, json, render_my_status)
}

/// `GET /api/competitions/:id/leaderboard`：需要登录，且持有报名或组队任一权限（和 `comp mine` 同一个关口）。
pub async fn ladder(ctx: &Context, id: String, json: bool) -> i32 {
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
    let outcome = call(ctx, &format!("/api/competitions/{id}/leaderboard")).await;
    emit(&outcome, json, render_ladder)
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

async fn post_call(ctx: &Context, path: &str, body: &Value) -> Outcome {
    match ctx.client() {
        Ok(client) => match client.post_json::<_, Value>(path, body).await {
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

fn render_one(data: &Value) {
    let name = data
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or("(无名称)");
    let status = data.get("status").and_then(Value::as_str).unwrap_or("");
    let description = data
        .get("description")
        .and_then(Value::as_str)
        .unwrap_or("");
    println!("{name} ({status})");
    if !description.is_empty() {
        println!("{description}");
    }
}

/// 报名、退出报名与各个队伍写操作共用这个响应体（`myStatus`），只挑 state 和报名备注给人看。
fn render_my_status(data: &Value) {
    let state = data.get("state").and_then(Value::as_str).unwrap_or("?");
    println!("状态：{state}");
    if let Some(note) = data
        .get("signup")
        .and_then(|signup| signup.get("note"))
        .and_then(Value::as_str)
        .filter(|note| !note.is_empty())
    {
        println!("备注：{note}");
    }
}

fn render_ladder(data: &Value) {
    let individuals = data
        .get("individuals")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    if individuals.is_empty() {
        println!("还没有榜。");
        return;
    }
    for entry in individuals {
        let rank = entry.get("rank").and_then(Value::as_i64).unwrap_or(0);
        let login = entry
            .get("person")
            .and_then(|person| person.get("login"))
            .and_then(Value::as_str)
            .unwrap_or("?");
        let points = entry.get("points").and_then(Value::as_i64).unwrap_or(0);
        println!("{rank}. {login}  {points} 分");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn signup_body_carries_note_and_looking_for_team_verbatim() {
        let body = signup_body("找队友", true);
        assert_eq!(body, json!({ "note": "找队友", "looking_for_team": true }));
        let empty = signup_body("", false);
        assert_eq!(empty, json!({ "note": "", "looking_for_team": false }));
    }
}
