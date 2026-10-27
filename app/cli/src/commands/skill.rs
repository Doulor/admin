use crate::cli::SkillTarget;
use crate::output::{emit, ErrorBody, ExitCode, Outcome};
use anyhow::{ensure, Context as _, Result};
use serde_json::json;
use std::io::{ErrorKind, Write};
use std::path::{Path, PathBuf};

/// 编译时把 skills/geek/SKILL.md 嵌进二进制：装技能不需要网络、不需要仓库在本机。
const SKILL_MD: &str = include_str!("../../skills/geek/SKILL.md");

fn home() -> Result<PathBuf> {
    dirs::home_dir().context("无法确定用户主目录")
}

fn skill_dir(variable: &str, default: PathBuf) -> PathBuf {
    std::env::var_os(variable)
        .and_then(|value| {
            if variable == "CLAUDE_CONFIG_DIR" {
                if let Some(text) = value.to_str() {
                    return (!text.trim().is_empty()).then(|| PathBuf::from(text.trim()));
                }
            }
            (!value.is_empty()).then(|| PathBuf::from(value))
        })
        .unwrap_or(default)
        .join("skills/geek")
}

fn omp_skill_dir(home: &Path) -> Result<PathBuf> {
    let config_name = std::env::var_os("PI_CONFIG_DIR")
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| ".omp".into());
    // OMP 的 PI_CONFIG_DIR 是接到 HOME 后的目录名，绝对值也不替换 HOME。
    let mut root = home.as_os_str().to_os_string();
    root.push(std::path::MAIN_SEPARATOR_STR);
    root.push(config_name);
    let root = PathBuf::from(root);

    let profile = std::env::var_os("OMP_PROFILE").or_else(|| std::env::var_os("PI_PROFILE"));
    let profile = profile
        .as_ref()
        .map(|value| value.to_str().context("OMP profile 名称必须是 UTF-8"))
        .transpose()?
        .map(str::trim)
        .filter(|name| !name.is_empty() && *name != "default");
    if let Some(name) = profile {
        let stem = name.split('.').next().unwrap_or_default();
        let reserved = matches!(stem, "con" | "prn" | "aux" | "nul")
            || ((stem.starts_with("com") || stem.starts_with("lpt"))
                && stem.len() == 4
                && stem.as_bytes()[3].is_ascii_digit());
        ensure!(
            name.len() <= 64
                && name
                    .bytes()
                    .next()
                    .is_some_and(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit())
                && name.bytes().all(|byte| {
                    byte.is_ascii_lowercase()
                        || byte.is_ascii_digit()
                        || matches!(byte, b'.' | b'_' | b'-')
                })
                && !name.ends_with('.')
                && !reserved,
            "OMP profile 名称无效"
        );
        // 命名 profile 优先于 PI_CODING_AGENT_DIR；default profile 仍允许显式目录。
        return Ok(root.join("profiles").join(name).join("agent/skills/geek"));
    }
    Ok(skill_dir("PI_CODING_AGENT_DIR", root.join("agent")))
}

fn target_dir(target: SkillTarget) -> Result<Vec<PathBuf>> {
    let home = home()?;
    let claude = || skill_dir("CLAUDE_CONFIG_DIR", home.join(".claude"));
    let codex = || skill_dir("CODEX_HOME", home.join(".codex"));
    Ok(match target {
        SkillTarget::Claude => vec![claude()],
        SkillTarget::Codex => vec![codex()],
        SkillTarget::Omp => vec![omp_skill_dir(&home)?],
        SkillTarget::All => vec![claude(), codex(), omp_skill_dir(&home)?],
    })
}

pub fn install(target: SkillTarget, json_output: bool) -> i32 {
    let outcome = match run(target) {
        Ok(result) => Outcome::ok(&result).unwrap(),
        Err(error) => Outcome::err(
            ExitCode::Other,
            ErrorBody::new("skill_install_failed", error.to_string()),
        ),
    };
    emit(&outcome, json_output, |data| {
        for (key, label) in [("installed", "已写入"), ("skipped", "保留已有")] {
            if let Some(paths) = data.get(key).and_then(|v| v.as_array()) {
                for path in paths {
                    if let Some(path) = path.as_str() {
                        println!("{label} {path}");
                    }
                }
            }
        }
    })
}

fn run(target: SkillTarget) -> Result<serde_json::Value> {
    let mut written = Vec::new();
    let mut skipped = Vec::new();
    for dir in target_dir(target)? {
        let file = dir.join("SKILL.md");
        match std::fs::symlink_metadata(&dir) {
            Ok(metadata) if metadata.file_type().is_symlink() => {
                skipped.push(file.display().to_string());
                continue;
            }
            Ok(_) => {}
            Err(error) if error.kind() == ErrorKind::NotFound => {}
            Err(error) => {
                return Err(error).with_context(|| format!("检查 {}", dir.display()));
            }
        }
        std::fs::create_dir_all(&dir).with_context(|| format!("创建 {}", dir.display()))?;
        // create_new 同时保护已有文件、文件符号链接和并发安装，不能先 exists 再 write。
        let mut output = match std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&file)
        {
            Ok(output) => output,
            Err(error) if error.kind() == ErrorKind::AlreadyExists => {
                skipped.push(file.display().to_string());
                continue;
            }
            Err(error) => {
                return Err(error).with_context(|| format!("创建 {}", file.display()));
            }
        };
        output
            .write_all(SKILL_MD.as_bytes())
            .with_context(|| format!("写入 {}", file.display()))?;
        written.push(file.display().to_string());
    }
    Ok(json!({ "installed": written, "skipped": skipped }))
}
