//! 令牌存取（SPEC §6）：`keyring` crate 存进系统钥匙串，不可用时退回系统配置目录下的 `geek/credentials`。
//! macOS 为 `~/Library/Application Support/geek/credentials`；Linux 为 `$XDG_CONFIG_HOME/geek/credentials`
//! （未设置时为 `~/.config/geek/credentials`），Unix 权限 0600。
//! `GEEK_TOKEN` 环境变量优先，给 CI 和 agent 用，不落盘、不写回钥匙串或文件。
//! 按源站分开存：生产和预发布各自的登录状态互不影响（和旧仓库 session.rs 的多 base 设计一致）。
//! `GEEK_NO_KEYRING=1` 强制跳过系统钥匙串、只用文件：没有图形会话的无头环境（CI、容器、这个仓库的
//! 本机端到端验证）里，未签名的二进制第一次碰钥匙串常常会弹一个没人能点的系统授权对话框，设了这个
//! 变量就不会碰，直接退回文件存储——不是降级，是给这类环境一个显式、可预期的开关。

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

const SERVICE: &str = "geek-cli";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredToken {
    pub access_token: String,
    pub scope: String,
    pub obtained_at: u64,
}

fn config_dir() -> Result<PathBuf> {
    let dir = dirs::config_dir()
        .context("无法确定用户配置目录")?
        .join("geek");
    std::fs::create_dir_all(&dir).with_context(|| format!("创建 {}", dir.display()))?;
    Ok(dir)
}

fn credentials_path() -> Result<PathBuf> {
    Ok(config_dir()?.join("credentials"))
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct FileStore {
    #[serde(default)]
    tokens: BTreeMap<String, StoredToken>,
}

fn read_file_store(path: &Path) -> Result<FileStore> {
    if !path.exists() {
        return Ok(FileStore::default());
    }
    let bytes = std::fs::read(path).with_context(|| format!("读取 {}", path.display()))?;
    serde_json::from_slice(&bytes).with_context(|| format!("解析 {}", path.display()))
}

fn write_file_store(path: &Path, store: &FileStore) -> Result<()> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)?;
    }
    let bytes = serde_json::to_vec_pretty(store)?;
    // 先写临时文件再 rename：避免在半写状态下被读到或被 Ctrl-C 截断成坏文件。
    let tmp = path.with_extension(format!("tmp-{}", std::process::id()));
    {
        use std::fs::OpenOptions;
        let mut options = OpenOptions::new();
        options.write(true).create(true).truncate(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut file = options
            .open(&tmp)
            .with_context(|| format!("创建 {}", tmp.display()))?;
        std::io::Write::write_all(&mut file, &bytes)?;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&tmp, std::fs::Permissions::from_mode(0o600))?;
    }
    std::fs::rename(&tmp, path).with_context(|| format!("替换 {}", path.display()))
}

fn keyring_entry(origin: &str) -> Option<keyring::Entry> {
    if std::env::var_os("GEEK_NO_KEYRING").is_some() {
        return None;
    }
    keyring::Entry::new(SERVICE, origin).ok()
}

/// 令牌来自哪一层（`geek status` 用来回答「从哪来的」，不回令牌本身）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TokenSource {
    Env,
    Keyring,
    File,
}

impl TokenSource {
    /// 给人看、也给 `--json` 用的说明（和 grade_label 一样，结构化输出里直接放中文）。
    pub fn label(self) -> &'static str {
        match self {
            TokenSource::Env => "GEEK_TOKEN 环境变量",
            TokenSource::Keyring => "系统钥匙串",
            TokenSource::File => "本机文件",
        }
    }
}

/// `GEEK_TOKEN` 优先、不落盘；其次系统钥匙串；最后文件。三层都没有就是没登录。带来源的版本见
/// [`load_with_source`]（`geek status` 用）；唯一的调用方是 `commands::Context::load`。
pub fn load_with_source(origin: &str) -> Result<Option<(StoredToken, TokenSource)>> {
    if let Ok(token) = std::env::var("GEEK_TOKEN") {
        let token = token.trim();
        if !token.is_empty() {
            return Ok(Some((
                StoredToken {
                    access_token: token.to_string(),
                    scope: String::new(),
                    obtained_at: 0,
                },
                TokenSource::Env,
            )));
        }
    }
    // 没有钥匙串、没有这一条、或者钥匙串本身不可用，都落到文件，不当作错误处理。
    if let Some(entry) = keyring_entry(origin) {
        if let Ok(secret) = entry.get_password() {
            if let Ok(stored) = serde_json::from_str::<StoredToken>(&secret) {
                return Ok(Some((stored, TokenSource::Keyring)));
            }
        }
    }
    let path = credentials_path()?;
    Ok(read_file_store(&path)?
        .tokens
        .get(origin)
        .cloned()
        .map(|stored| (stored, TokenSource::File)))
}

/// 存令牌：先试钥匙串，成功就不再写文件（文件里只留别的源站的旧记录）；钥匙串不可用时退回文件。
pub fn save(origin: &str, token: &StoredToken) -> Result<()> {
    let payload = serde_json::to_string(token)?;
    if let Some(entry) = keyring_entry(origin) {
        if entry.set_password(&payload).is_ok() {
            // 钥匙串写成功了，顺手把文件里这个源站的旧记录清掉，不留两份互相矛盾的凭据。
            if let Ok(path) = credentials_path() {
                if let Ok(mut store) = read_file_store(&path) {
                    if store.tokens.remove(origin).is_some() {
                        let _ = write_file_store(&path, &store);
                    }
                }
            }
            return Ok(());
        }
    }
    let path = credentials_path()?;
    let mut store = read_file_store(&path)?;
    store.tokens.insert(origin.to_string(), token.clone());
    write_file_store(&path, &store)
}

/// 清掉本机保存的这个源站的令牌（`geek logout` 用）；`GEEK_TOKEN` 只是环境变量，这里管不到，也不需要管。
pub fn clear(origin: &str) -> Result<()> {
    if let Some(entry) = keyring_entry(origin) {
        let _ = entry.delete_credential();
    }
    let path = credentials_path()?;
    let mut store = read_file_store(&path)?;
    if store.tokens.remove(origin).is_some() {
        write_file_store(&path, &store)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp_path(tag: &str) -> PathBuf {
        let mut path = std::env::temp_dir();
        path.push(format!(
            "geek-cli-credentials-{tag}-{}.json",
            std::process::id()
        ));
        let _ = std::fs::remove_file(&path);
        path
    }

    #[test]
    fn file_store_roundtrips_and_isolates_origins() {
        let path = tmp_path("roundtrip");
        let mut store = FileStore::default();
        store.tokens.insert(
            "https://a.example".into(),
            StoredToken {
                access_token: "a".into(),
                scope: "openid".into(),
                obtained_at: 1,
            },
        );
        store.tokens.insert(
            "https://b.example".into(),
            StoredToken {
                access_token: "b".into(),
                scope: "openid".into(),
                obtained_at: 2,
            },
        );
        write_file_store(&path, &store).unwrap();
        let loaded = read_file_store(&path).unwrap();
        assert_eq!(
            loaded.tokens.get("https://a.example").unwrap().access_token,
            "a"
        );
        assert_eq!(
            loaded.tokens.get("https://b.example").unwrap().access_token,
            "b"
        );
        let _ = std::fs::remove_file(&path);
    }

    #[cfg(unix)]
    #[test]
    fn file_store_is_0600() {
        use std::os::unix::fs::PermissionsExt;
        let path = tmp_path("mode");
        write_file_store(&path, &FileStore::default()).unwrap();
        let mode = std::fs::metadata(&path).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode, 0o600);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn geek_token_env_wins_without_touching_disk() {
        if !crate::test_env::isolated(
            "token_store::tests::geek_token_env_wins_without_touching_disk",
        ) {
            return;
        }
        std::env::set_var("GEEK_TOKEN", "gk_from_env");
        let loaded = load_with_source("https://example.test").unwrap().unwrap();
        assert_eq!(loaded.0.access_token, "gk_from_env");
        std::env::remove_var("GEEK_TOKEN");
    }

    #[test]
    fn load_with_source_reports_env_then_file() {
        if !crate::test_env::isolated("token_store::tests::load_with_source_reports_env_then_file")
        {
            return;
        }
        std::env::set_var("GEEK_TOKEN", "gk_from_env");
        let (stored, source) = load_with_source("https://example.test").unwrap().unwrap();
        assert_eq!(stored.access_token, "gk_from_env");
        assert_eq!(source, TokenSource::Env);
        assert_eq!(source.label(), "GEEK_TOKEN 环境变量");
        std::env::remove_var("GEEK_TOKEN");

        // GEEK_NO_KEYRING 跳过钥匙串，三层都没有时是 None；写进文件之后来源是 File。
        std::env::set_var("GEEK_NO_KEYRING", "1");
        assert!(load_with_source("https://example.test").unwrap().is_none());
        let path = tmp_path("source-file");
        let mut store = FileStore::default();
        store.tokens.insert(
            "https://example.test".into(),
            StoredToken {
                access_token: "from-file".into(),
                scope: String::new(),
                obtained_at: 0,
            },
        );
        write_file_store(&path, &store).unwrap();
        let loaded = read_file_store(&path)
            .unwrap()
            .tokens
            .get("https://example.test")
            .cloned();
        assert_eq!(
            loaded.map(|stored| (stored.access_token, TokenSource::File)),
            Some(("from-file".into(), TokenSource::File))
        );
        std::env::remove_var("GEEK_NO_KEYRING");
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn geek_no_keyring_forces_keyring_entry_to_none() {
        if !crate::test_env::isolated(
            "token_store::tests::geek_no_keyring_forces_keyring_entry_to_none",
        ) {
            return;
        }
        std::env::set_var("GEEK_NO_KEYRING", "1");
        assert!(keyring_entry("https://example.test").is_none());
        std::env::remove_var("GEEK_NO_KEYRING");
    }
}
