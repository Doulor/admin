//! 对核心服务的 HTTP 封装：统一带 `Authorization: Bearer`、统一把服务端错误体翻成
//! `output::ExitCode` + `output::ErrorBody`，命令模块不用各自处理状态码。

use crate::output::{ErrorBody, ExitCode};
use anyhow::{Context, Result};
use serde::de::DeserializeOwned;
use std::time::Duration;

pub struct Client {
    http: reqwest::Client,
    origin: String,
    token: Option<String>,
}

/// 服务端业务错误体的只读视图：字段都是可选的，不同接口回的形状不完全一致（OAuth 风格的
/// `error`/`error_description`，业务风格的 `error`/`message`/`request_id`/`retry_after`）。
#[derive(Debug, Clone, Default, serde::Deserialize)]
struct ErrorPayload {
    #[serde(default)]
    error: Option<String>,
    #[serde(default)]
    message: Option<String>,
    #[serde(default)]
    error_description: Option<String>,
    #[serde(default)]
    retry_after: Option<u64>,
}

pub enum ApiOutcome<T> {
    Ok(T),
    Err(ExitCode, ErrorBody),
}

impl Client {
    pub fn new(origin: String, token: Option<String>) -> Result<Self> {
        let http = reqwest::Client::builder()
            .user_agent(concat!("geek-cli/", env!("CARGO_PKG_VERSION")))
            .timeout(Duration::from_secs(20))
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .context("无法创建 HTTP 客户端")?;
        Ok(Self {
            http,
            origin,
            token,
        })
    }

    fn url(&self, path: &str) -> String {
        format!("{}{}", self.origin, path)
    }

    pub async fn get_json<T: DeserializeOwned>(&self, path: &str) -> Result<ApiOutcome<T>> {
        let mut request = self.http.get(self.url(path));
        if let Some(token) = &self.token {
            request = request.bearer_auth(token);
        }
        self.send(request).await
    }

    pub async fn post_json<B: serde::Serialize, T: DeserializeOwned>(
        &self,
        path: &str,
        body: &B,
    ) -> Result<ApiOutcome<T>> {
        let mut request = self.http.post(self.url(path)).json(body);
        if let Some(token) = &self.token {
            request = request.bearer_auth(token);
        }
        self.send(request).await
    }

    async fn send<T: DeserializeOwned>(
        &self,
        request: reqwest::RequestBuilder,
    ) -> Result<ApiOutcome<T>> {
        let response = match request.send().await {
            Ok(response) => response,
            Err(error) => {
                let message = if error.is_timeout() {
                    "连接超时，请检查网络或稍后重试".to_string()
                } else {
                    format!("无法连接服务：{error}")
                };
                return Ok(ApiOutcome::Err(
                    ExitCode::Network,
                    ErrorBody::new("network_error", message),
                ));
            }
        };
        let status = response.status();
        let bytes = response.bytes().await.unwrap_or_default();
        if status.is_success() {
            let value: T = serde_json::from_slice(&bytes)
                .with_context(|| format!("响应不是预期的 JSON（HTTP {status}）"))?;
            return Ok(ApiOutcome::Ok(value));
        }
        let payload: ErrorPayload = serde_json::from_slice(&bytes).unwrap_or_default();
        let code = payload
            .error
            .clone()
            .unwrap_or_else(|| format!("http_{}", status.as_u16()));
        let message = payload
            .message
            .clone()
            .or(payload.error_description.clone())
            .unwrap_or_else(|| format!("请求失败（HTTP {status}）"));
        let exit = exit_code_for(status, &code);
        let mut body = ErrorBody::new(code, message);
        if let Some(seconds) = payload.retry_after {
            body = body.with_retry_after(seconds);
        }
        Ok(ApiOutcome::Err(exit, body))
    }
}

fn exit_code_for(status: reqwest::StatusCode, code: &str) -> ExitCode {
    match status.as_u16() {
        401 => ExitCode::NotSignedIn,
        403 => ExitCode::Forbidden,
        429 => ExitCode::RateLimited,
        _ if code == "email_required" || code == "profile_required" => ExitCode::Forbidden,
        _ => ExitCode::Other,
    }
}

/// 403 `email_required` / `profile_required`：命令行没有浏览器会话，只能让用户自己去网页上处理一次。
pub fn gate_message(origin: &str, code: &str) -> Option<String> {
    match code {
        "email_required" => Some(format!(
            "账号还没有绑定登录邮箱，请在浏览器打开 {origin}/bind-email 绑定后再使用命令行"
        )),
        "profile_required" => Some(format!(
            "账号资料还没有填完，请在浏览器打开 {origin}/complete-profile 补完后再使用命令行"
        )),
        _ => None,
    }
}

/// 把一次 API 结果直接转成命令的 `Outcome`：成功时调用方决定怎么序列化，这里只处理失败分支的
/// 退出码与（email_required/profile_required 时）更友好的提示文字。
pub fn into_outcome<T: serde::Serialize>(
    origin: &str,
    outcome: ApiOutcome<T>,
) -> crate::output::Outcome {
    match outcome {
        ApiOutcome::Ok(value) => crate::output::Outcome::ok(&value).unwrap(),
        ApiOutcome::Err(exit, mut body) => {
            if let Some(hint) = gate_message(origin, &body.code) {
                body.message = hint;
            }
            crate::output::Outcome::err(exit, body)
        }
    }
}
