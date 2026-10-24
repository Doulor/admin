use super::Context;
use crate::api::into_outcome;
use crate::output::{emit, ErrorBody, ExitCode, Outcome};
use serde_json::{json, Value};

pub async fn list(ctx: &Context, json: bool) -> i32 {
    let outcome = match ctx.client() {
        Ok(client) => match client.get_json::<Value>("/api/forum/state").await {
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
    emit(&outcome, json, render_list)
}

fn render_list(data: &Value) {
    let topics = data
        .get("state")
        .and_then(|state| state.get("topics"))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    if topics.is_empty() {
        println!("没有话题。");
        return;
    }
    for topic in topics {
        let title = topic
            .get("title")
            .and_then(Value::as_str)
            .unwrap_or("(无标题)");
        let id = topic.get("id").and_then(Value::as_str).unwrap_or("?");
        println!("[{id}] {title}");
    }
}

pub async fn post(
    ctx: &Context,
    title: String,
    category: String,
    content: String,
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
    let outcome = match ctx.client() {
        Ok(client) => {
            let body = json!({ "title": title, "categoryId": category, "content": content });
            match client
                .post_json::<_, Value>("/api/forum/topics", &body)
                .await
            {
                Ok(outcome) => into_outcome(&ctx.origin, outcome),
                Err(error) => Outcome::err(
                    ExitCode::Network,
                    ErrorBody::new("network_error", error.to_string()),
                ),
            }
        }
        Err(error) => Outcome::err(
            ExitCode::Other,
            ErrorBody::new("client_error", error.to_string()),
        ),
    };
    emit(&outcome, json, |data| {
        let id = data.get("topicId").and_then(Value::as_str).unwrap_or("?");
        println!("发帖成功：{id}");
    })
}
