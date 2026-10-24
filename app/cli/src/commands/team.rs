use super::Context;
use crate::api::into_outcome;
use crate::output::{emit, ErrorBody, ExitCode, Outcome};
use serde_json::{json, Value};

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
