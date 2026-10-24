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

/// `GET /api/forum/topics/:topic_id/posts`：话题的全部帖子（含正文），公开接口，不需要登录。
pub async fn show(ctx: &Context, topic_id: String, json: bool) -> i32 {
    let outcome = match ctx.client() {
        Ok(client) => match client
            .get_json::<Value>(&format!("/api/forum/topics/{topic_id}/posts"))
            .await
        {
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
    emit(&outcome, json, render_posts)
}

fn render_posts(data: &Value) {
    let posts = data
        .get("posts")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    if posts.is_empty() {
        println!("没有帖子。");
        return;
    }
    for post in posts {
        let id = post.get("id").and_then(Value::as_str).unwrap_or("?");
        let author = post.get("authorId").and_then(Value::as_str).unwrap_or("?");
        let content = post.get("content").and_then(Value::as_str).unwrap_or("");
        println!("[{id}] {author}：{content}");
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

/// 回复请求体：抽成纯函数方便单测，不用真的发请求就能核对字段名和话题 id 是不是原样传下去。
fn reply_body(topic_id: &str, content: &str) -> Value {
    json!({ "topicId": topic_id, "content": content })
}

/// `POST /api/forum/posts`：需要 `forum.reply.create` 权限节点（注册用户默认没有，只有极客班成员
/// 才有），令牌还要带 `forum` scope。
pub async fn reply(ctx: &Context, topic_id: String, content: String, json: bool) -> i32 {
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
            let body = reply_body(&topic_id, &content);
            match client
                .post_json::<_, Value>("/api/forum/posts", &body)
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
        let id = data.get("postId").and_then(Value::as_str).unwrap_or("?");
        println!("回复成功：{id}");
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reply_body_carries_topic_id_and_content_verbatim() {
        let body = reply_body("t42", "你好");
        assert_eq!(body, json!({ "topicId": "t42", "content": "你好" }));
    }
}
