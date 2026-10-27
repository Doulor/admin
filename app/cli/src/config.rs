//! 环境解析（SPEC §6）：`--env production|preview`，或者 `GEEK_ORIGIN`，默认 `https://yangtzeu.work`。
//! `--env` 优先于 `GEEK_ORIGIN`——显式选了哪个环境就用哪个，不混着猜。

use anyhow::{bail, Result};
use clap::ValueEnum;

pub const PRODUCTION_ORIGIN: &str = "https://yangtzeu.work";
pub const PREVIEW_ORIGIN: &str = "https://prev.yangtzeu.work";

#[derive(Clone, Copy, Debug, PartialEq, Eq, ValueEnum)]
pub enum Env {
    Production,
    Preview,
}

impl Env {
    pub fn origin(self) -> &'static str {
        match self {
            Env::Production => PRODUCTION_ORIGIN,
            Env::Preview => PREVIEW_ORIGIN,
        }
    }
}

/// 解析这次调用要用哪个源站：`--env` > `GEEK_ORIGIN` > 默认正式环境。源站必须是没有路径、查询、
/// 凭据的 http(s) 源（本机回环地址允许 http，方便对着本地起的测试服务器跑）。
pub fn resolve_origin(env: Option<Env>) -> Result<String> {
    if let Some(env) = env {
        return Ok(env.origin().to_string());
    }
    if let Ok(origin) = std::env::var("GEEK_ORIGIN") {
        let origin = origin.trim();
        if !origin.is_empty() {
            return validate_origin(origin);
        }
    }
    Ok(PRODUCTION_ORIGIN.to_string())
}

pub fn validate_origin(raw: &str) -> Result<String> {
    let url =
        url::Url::parse(raw).map_err(|_| anyhow::anyhow!("GEEK_ORIGIN 不是合法的 URL：{raw}"))?;
    let loopback = match url.host() {
        Some(url::Host::Ipv4(ip)) => ip.is_loopback(),
        Some(url::Host::Ipv6(ip)) => ip.is_loopback(),
        Some(url::Host::Domain(host)) => host == "localhost",
        None => false,
    };
    let scheme_ok = url.scheme() == "https" || (url.scheme() == "http" && loopback);
    if !scheme_ok
        || url.host().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.path() != "/" && !url.path().is_empty()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        bail!("GEEK_ORIGIN 只支持不含凭据、路径、查询参数的 HTTPS 源站（本机回环地址允许 HTTP）：{raw}");
    }
    Ok(format!("{}://{}", url.scheme(), url.host_str().unwrap()).to_string() + &port_suffix(&url))
}

fn port_suffix(url: &url::Url) -> String {
    match url.port() {
        Some(port) => format!(":{port}"),
        None => String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_is_production() {
        if !crate::test_env::isolated("config::tests::default_is_production") {
            return;
        }
        std::env::remove_var("GEEK_ORIGIN");
        assert_eq!(resolve_origin(None).unwrap(), PRODUCTION_ORIGIN);
    }

    #[test]
    fn env_flag_wins_over_geek_origin() {
        assert_eq!(resolve_origin(Some(Env::Preview)).unwrap(), PREVIEW_ORIGIN);
    }

    #[test]
    fn rejects_credentials_paths_and_cleartext_remotes() {
        for bad in [
            "http://yangtzeu.work",
            "https://user:pass@yangtzeu.work",
            "https://yangtzeu.work/console",
            "https://yangtzeu.work/?x=1",
            "not a url",
        ] {
            assert!(validate_origin(bad).is_err(), "accepted {bad}");
        }
        for good in [
            "https://prev.yangtzeu.work",
            "http://127.0.0.1:18080",
            "http://localhost:3000",
        ] {
            assert!(validate_origin(good).is_ok(), "rejected {good}");
        }
    }
}
