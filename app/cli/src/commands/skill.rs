use crate::cli::SkillTarget;
use crate::output::{emit, ErrorBody, ExitCode, Outcome};
use anyhow::{Context as _, Result};
use serde_json::json;
use std::path::PathBuf;

/// 编译时把 skills/geek/SKILL.md 嵌进二进制：装技能不需要网络、不需要仓库在本机。
const SKILL_MD: &str = include_str!("../../skills/geek/SKILL.md");

fn home() -> Result<PathBuf> {
    dirs::home_dir().context("无法确定用户主目录")
}

fn target_dir(target: SkillTarget) -> Result<Vec<PathBuf>> {
    let home = home()?;
    Ok(match target {
        SkillTarget::Claude => vec![home.join(".claude/skills/geek")],
        SkillTarget::Codex => vec![home.join(".codex/skills/geek")],
        SkillTarget::Omp => vec![home.join(".omp/skills/geek")],
        SkillTarget::All => {
            vec![
                home.join(".claude/skills/geek"),
                home.join(".codex/skills/geek"),
                home.join(".omp/skills/geek"),
            ]
        }
    })
}

pub fn install(target: SkillTarget, json_output: bool) -> i32 {
    let outcome = match run(target) {
        Ok(paths) => Outcome::ok(&json!({ "installed": paths })).unwrap(),
        Err(error) => Outcome::err(
            ExitCode::Other,
            ErrorBody::new("skill_install_failed", error.to_string()),
        ),
    };
    emit(&outcome, json_output, |data| {
        if let Some(paths) = data.get("installed").and_then(|v| v.as_array()) {
            for path in paths {
                if let Some(path) = path.as_str() {
                    println!("已写入 {path}");
                }
            }
        }
    })
}

fn run(target: SkillTarget) -> Result<Vec<String>> {
    let mut written = Vec::new();
    for dir in target_dir(target)? {
        std::fs::create_dir_all(&dir).with_context(|| format!("创建 {}", dir.display()))?;
        let file = dir.join("SKILL.md");
        std::fs::write(&file, SKILL_MD).with_context(|| format!("写入 {}", file.display()))?;
        written.push(file.display().to_string());
    }
    Ok(written)
}
