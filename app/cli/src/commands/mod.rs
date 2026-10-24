pub mod apply;
pub mod comp;
pub mod forum;
pub mod login;
pub mod logout;
pub mod repo;
pub mod skill;
pub mod status;
pub mod team;
pub mod whoami;

use crate::api::Client;
use crate::token_store::{self, TokenSource};
use anyhow::Result;

/// 一次命令调用共享的上下文：源站、已登录的令牌（没登录时是 None）、令牌来自哪一层（`geek status` 用）。
pub struct Context {
    pub origin: String,
    pub token: Option<String>,
    pub token_source: Option<TokenSource>,
}

impl Context {
    pub fn load(origin: String) -> Result<Self> {
        let loaded = token_store::load_with_source(&origin)?;
        let token = loaded
            .as_ref()
            .map(|(stored, _)| stored.access_token.clone());
        let token_source = loaded.map(|(_, source)| source);
        Ok(Self {
            origin,
            token,
            token_source,
        })
    }

    pub fn client(&self) -> Result<Client> {
        Client::new(self.origin.clone(), self.token.clone())
    }
}
