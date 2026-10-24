pub mod comp;
pub mod forum;
pub mod login;
pub mod logout;
pub mod repo;
pub mod skill;
pub mod team;
pub mod whoami;

use crate::api::Client;
use crate::token_store;
use anyhow::Result;

/// 一次命令调用共享的上下文：源站、已登录的令牌（没登录时是 None）。
pub struct Context {
    pub origin: String,
    pub token: Option<String>,
}

impl Context {
    pub fn load(origin: String) -> Result<Self> {
        let token = token_store::load(&origin)?.map(|stored| stored.access_token);
        Ok(Self { origin, token })
    }

    pub fn client(&self) -> Result<Client> {
        Client::new(self.origin.clone(), self.token.clone())
    }
}
