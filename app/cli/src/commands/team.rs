use super::Context;
use crate::api::into_outcome;
use crate::output::{emit, ErrorBody, ExitCode, Outcome};
use serde_json::{json, Value};

/// 建队请求体：抽成纯函数方便单测，不用真的发请求就能核对字段名；`slogan` 空字符串原样传下去，
/// 服务端的 `signupBody.teamCreate` 没有把它设为必填。
fn create_body(name: &str, slogan: &str) -> Value {
    json!({ "name": name, "slogan": slogan })
}

/// `POST /api/competitions/:id/teams`：需要 `competition.team` 权限节点（注册用户默认没有），
/// 令牌还要带 `competition` scope（这条路径按 `/api/competitions/` 前缀归到这一类，不是 `apply`）。
pub async fn create(
    ctx: &Context,
    competition_id: String,
    name: String,
    slogan: String,
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
            let body = create_body(&name, &slogan);
            match client
                .post_json::<_, Value>(&format!("/api/competitions/{competition_id}/teams"), &body)
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
        let id = data
            .get("team")
            .and_then(|team| team.get("id"))
            .and_then(Value::as_str)
            .unwrap_or("?");
        println!("建队成功：{id}");
    })
}

/// `POST /api/teams/:id/apply`：需要 `competition.team` 权限节点（注册用户默认没有，只有极客班
/// 成员才有），令牌还要带 `apply` scope（`middleware/bearer-auth.ts` 把这条路径归到这一类）。
pub async fn apply(ctx: &Context, team_id: String, message: String, json: bool) -> i32 {
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
            let body = json!({ "message": message });
            match client
                .post_json::<_, Value>(&format!("/api/teams/{team_id}/apply"), &body)
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
    emit(&outcome, json, |_| println!("已提交申请。"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_body_carries_name_and_slogan_verbatim() {
        let body = create_body("夜猫子", "通宵也要交付");
        assert_eq!(body, json!({ "name": "夜猫子", "slogan": "通宵也要交付" }));
        let no_slogan = create_body("夜猫子", "");
        assert_eq!(no_slogan, json!({ "name": "夜猫子", "slogan": "" }));
    }
}
