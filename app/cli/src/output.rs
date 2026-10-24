//! `--json` 输出与退出码（SPEC §6）：`{ ok, data | error: { code, message, retry_after? } }`，
//! 退出码 0 成功、2 用法错误、3 没登录、4 权限不够、5 被限流、6 网络错误、1 其它错误。

use serde::Serialize;
use serde_json::Value;
use std::io::IsTerminal;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ExitCode {
    Ok = 0,
    Usage = 2,
    NotSignedIn = 3,
    Forbidden = 4,
    RateLimited = 5,
    Network = 6,
    Other = 1,
}

impl ExitCode {
    pub fn code(self) -> i32 {
        self as i32
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ErrorBody {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retry_after: Option<u64>,
}

impl ErrorBody {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            retry_after: None,
        }
    }
    pub fn with_retry_after(mut self, seconds: u64) -> Self {
        self.retry_after = Some(seconds);
        self
    }
}

/// 命令的结果：成功带任意可序列化的数据，失败带错误体与对应的退出码。
pub enum Outcome {
    Ok(Value),
    Err(ExitCode, ErrorBody),
}

impl Outcome {
    pub fn ok<T: Serialize>(data: &T) -> anyhow::Result<Self> {
        Ok(Outcome::Ok(serde_json::to_value(data)?))
    }
    pub fn err(code: ExitCode, body: ErrorBody) -> Self {
        Outcome::Err(code, body)
    }
}

#[derive(Serialize)]
struct JsonOk<'a> {
    ok: bool,
    data: &'a Value,
}
#[derive(Serialize)]
struct JsonErr<'a> {
    ok: bool,
    error: &'a ErrorBody,
}

/// `--json` 时打印 `{ok,data}` 或 `{ok:false,error}`；人类可读模式下成功打印 `render`
/// 给的文字，失败打印 `错误：<message>` 到 stderr。返回这次调用该用的退出码。
pub fn emit(outcome: &Outcome, json: bool, render: impl FnOnce(&Value)) -> i32 {
    match outcome {
        Outcome::Ok(data) => {
            if json {
                println!(
                    "{}",
                    serde_json::to_string(&JsonOk { ok: true, data }).unwrap()
                );
            } else {
                render(data);
            }
            ExitCode::Ok.code()
        }
        Outcome::Err(code, error) => {
            if json {
                println!(
                    "{}",
                    serde_json::to_string(&JsonErr { ok: false, error }).unwrap()
                );
            } else {
                eprintln!("错误：{}", error.message);
                if let Some(seconds) = error.retry_after {
                    eprintln!("请在 {seconds} 秒后重试。");
                }
            }
            code.code()
        }
    }
}

/// 三条都满足才算交互式终端：stdin/stdout/stderr 都连着真实终端，没有 `--json`，没有 `NO_COLOR`。
/// `CI` 环境变量存在时同样当作非交互（避免流水线日志里混进控制字符）。
pub fn interactive(json: bool) -> bool {
    !json
        && std::env::var_os("NO_COLOR").is_none()
        && std::env::var_os("CI").is_none()
        && std::io::stdin().is_terminal()
        && std::io::stdout().is_terminal()
        && std::io::stderr().is_terminal()
}
