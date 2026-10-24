use super::Context;
use crate::api::into_outcome;
use crate::output::{emit, ErrorBody, ExitCode, Outcome};
use serde_json::Value;

/// `GET /api/public/gitlab/projects`：公开接口，不需要登录；带了令牌也会走 scope 为 `repo` 的那条检查
/// （`middleware/bearer-auth.ts` 的 `SCOPE_BY_PREFIX`）。
pub async fn list(ctx: &Context, json: bool) -> i32 {
    let outcome = match ctx.client() {
        Ok(client) => match client
            .get_json::<Value>("/api/public/gitlab/projects")
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
    emit(&outcome, json, render)
}

fn render(data: &Value) {
    if data
        .get("unavailable")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        println!("GitLab 同步暂时不可用。");
        return;
    }
    let projects = data
        .get("projects")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    if projects.is_empty() {
        println!("没有公开仓库。");
        return;
    }
    for project in projects {
        let path = project
            .get("path_with_namespace")
            .and_then(Value::as_str)
            .unwrap_or("?");
        let description = project
            .get("description")
            .and_then(Value::as_str)
            .unwrap_or("");
        println!("{path}  {description}");
    }
}
