use super::Context;
use crate::output::{emit, ErrorBody, ExitCode, Outcome};
use crate::token_store;
use serde_json::{json, Value};

/// 调 `POST /auth/device/revoke` 撤销令牌，再清掉本机保存的那一份；两步都做，缺一不可——只清本机
/// 而不撤销，服务端那个令牌还能用；只撤销不清本机，下次用本机凭据还是会拿到一个已经失效的令牌。
pub async fn run(ctx: &Context, json_output: bool) -> i32 {
    let outcome = revoke_and_clear(ctx).await;
    emit(&outcome, json_output, |_| println!("已退出登录。"))
}

async fn revoke_and_clear(ctx: &Context) -> Outcome {
    if ctx.token.is_some() {
        if let Ok(client) = ctx.client() {
            let _: Result<crate::api::ApiOutcome<Value>, _> =
                client.post_json("/auth/device/revoke", &json!({})).await;
        }
    }
    match token_store::clear(&ctx.origin) {
        Ok(()) => Outcome::ok(&json!({ "signed_out": true })).unwrap(),
        Err(error) => Outcome::err(
            ExitCode::Other,
            ErrorBody::new("local_store_error", error.to_string()),
        ),
    }
}
