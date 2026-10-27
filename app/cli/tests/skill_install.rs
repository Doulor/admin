use serde_json::Value;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use std::sync::atomic::{AtomicUsize, Ordering};

const SKILL_MD: &str = include_str!("../skills/geek/SKILL.md");
static NEXT_HOME: AtomicUsize = AtomicUsize::new(0);

struct Home {
    root: PathBuf,
}

impl Home {
    fn new() -> Self {
        let root = std::env::temp_dir().join(format!(
            "geek_skill_install_{}_{}",
            std::process::id(),
            NEXT_HOME.fetch_add(1, Ordering::Relaxed)
        ));
        std::fs::create_dir(&root).unwrap();
        Self { root }
    }

    fn path(&self, relative: &str) -> PathBuf {
        self.root.join(relative)
    }

    fn install(&self, target: &str, overrides: &[(&str, &Path)]) -> Output {
        Command::new(env!("CARGO_BIN_EXE_geek"))
            .args(["skill", "install", "--target", target, "--json"])
            .env_clear()
            .env("HOME", &self.root)
            .env("USERPROFILE", &self.root)
            .env("XDG_CONFIG_HOME", self.path(".config"))
            .env("GEEK_NO_KEYRING", "1")
            .env("GEEK_ORIGIN", "http://127.0.0.1:9")
            .envs(overrides.iter().copied())
            .current_dir(&self.root)
            .output()
            .unwrap()
    }
}

impl Drop for Home {
    fn drop(&mut self) {
        std::fs::remove_dir_all(&self.root).unwrap();
    }
}

fn success(output: &Output) -> Value {
    assert!(
        output.status.success(),
        "stdout: {}\nstderr: {}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(output.stderr.is_empty());
    let value: Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(value["ok"], true);
    value
}

#[test]
fn default_omp_install_uses_the_agent_skill_directory() {
    let home = Home::new();
    let value = success(&home.install("omp", &[]));
    let skill = home.path(".omp/agent/skills/geek/SKILL.md");
    assert_eq!(value["data"]["installed"], serde_json::json!([skill]));
    assert_eq!(std::fs::read_to_string(skill).unwrap(), SKILL_MD);
    assert!(!home.path(".omp/skills/geek/SKILL.md").exists());
}

#[test]
fn explicit_harness_directories_replace_the_defaults() {
    let home = Home::new();
    for (target, variable, fallback) in [
        (
            "claude",
            "CLAUDE_CONFIG_DIR",
            ".claude/skills/geek/SKILL.md",
        ),
        ("codex", "CODEX_HOME", ".codex/skills/geek/SKILL.md"),
        (
            "omp",
            "PI_CODING_AGENT_DIR",
            ".omp/agent/skills/geek/SKILL.md",
        ),
    ] {
        let custom = home.path(&format!("custom_{target}"));
        let value = success(&home.install(target, &[(variable, &custom)]));
        let skill = custom.join("skills/geek/SKILL.md");
        assert_eq!(value["data"]["installed"], serde_json::json!([skill]));
        assert_eq!(std::fs::read_to_string(skill).unwrap(), SKILL_MD);
        assert!(!home.path(fallback).exists());
    }
}

#[test]
fn reinstall_preserves_existing_and_custom_skills_without_rewriting() {
    let home = Home::new();
    let first = success(&home.install("all", &[]));
    assert_eq!(first["data"]["installed"].as_array().unwrap().len(), 3);
    let paths = [
        home.path(".claude/skills/geek/SKILL.md"),
        home.path(".codex/skills/geek/SKILL.md"),
        home.path(".omp/agent/skills/geek/SKILL.md"),
    ];
    std::fs::write(&paths[0], "# My custom geek skill\n").unwrap();
    let before: Vec<_> = paths
        .iter()
        .map(|path| {
            (
                std::fs::read(path).unwrap(),
                std::fs::metadata(path).unwrap().modified().unwrap(),
            )
        })
        .collect();

    let second = success(&home.install("all", &[]));
    assert_eq!(second["data"]["installed"], serde_json::json!([]));
    assert_eq!(second["data"]["skipped"], serde_json::json!(paths));
    for (path, (bytes, modified)) in paths.iter().zip(before) {
        assert_eq!(std::fs::read(path).unwrap(), bytes);
        assert_eq!(
            std::fs::metadata(path).unwrap().modified().unwrap(),
            modified
        );
    }
}

#[cfg(unix)]
#[test]
fn custom_skill_symlinks_are_preserved_without_following_them() {
    use std::os::unix::fs::symlink;

    for kind in ["directory", "file", "dangling"] {
        let home = Home::new();
        let owner = home.path("owner_skill");
        let skill = home.path(".omp/agent/skills/geek/SKILL.md");
        std::fs::create_dir_all(skill.parent().unwrap().parent().unwrap()).unwrap();
        let link = if kind == "directory" {
            std::fs::create_dir(&owner).unwrap();
            std::fs::write(owner.join("asset.txt"), "owner asset").unwrap();
            skill.parent().unwrap().to_path_buf()
        } else {
            std::fs::create_dir_all(skill.parent().unwrap()).unwrap();
            if kind == "file" {
                std::fs::write(&owner, "owner skill").unwrap();
            }
            skill.clone()
        };
        symlink(&owner, &link).unwrap();

        let value = success(&home.install("omp", &[]));
        assert_eq!(value["data"]["installed"], serde_json::json!([]));
        assert_eq!(value["data"]["skipped"], serde_json::json!([skill]));
        assert_eq!(std::fs::read_link(&link).unwrap(), owner);
        match kind {
            "directory" => {
                assert!(!owner.join("SKILL.md").exists());
                assert_eq!(
                    std::fs::read_to_string(owner.join("asset.txt")).unwrap(),
                    "owner asset"
                );
            }
            "file" => assert_eq!(std::fs::read_to_string(&owner).unwrap(), "owner skill"),
            _ => assert!(!owner.exists()),
        }
    }
}

#[test]
fn omp_profile_roots_follow_the_native_environment_precedence() {
    let cases: &[(&[(&str, &str)], &str)] = &[
        (
            &[
                ("OMP_PROFILE", "work"),
                ("PI_PROFILE", "legacy"),
                ("PI_CONFIG_DIR", ".omp_custom"),
                ("PI_CODING_AGENT_DIR", "ignored"),
            ],
            ".omp_custom/profiles/work/agent/skills/geek/SKILL.md",
        ),
        (
            &[("PI_PROFILE", "legacy")],
            ".omp/profiles/legacy/agent/skills/geek/SKILL.md",
        ),
        (
            &[
                ("OMP_PROFILE", "default"),
                ("PI_CODING_AGENT_DIR", "custom_omp"),
            ],
            "custom_omp/skills/geek/SKILL.md",
        ),
        (
            &[("OMP_PROFILE", " "), ("PI_PROFILE", "legacy")],
            ".omp/agent/skills/geek/SKILL.md",
        ),
    ];
    for (variables, expected) in cases {
        let home = Home::new();
        let overrides: Vec<_> = variables
            .iter()
            .map(|(key, value)| (*key, Path::new(value)))
            .collect();
        success(&home.install("omp", &overrides));
        assert_eq!(
            std::fs::read_to_string(home.path(expected)).unwrap(),
            SKILL_MD
        );
        assert!(!home.path("ignored/skills/geek/SKILL.md").exists());
    }

    for invalid in ["../escape", "Work", "con", "aux.md", "work."] {
        let home = Home::new();
        let output = home.install("omp", &[("OMP_PROFILE", Path::new(invalid))]);
        assert_eq!(output.status.code(), Some(1));
        let value: Value = serde_json::from_slice(&output.stdout).unwrap();
        assert_eq!(value["error"]["code"], "skill_install_failed");
        assert!(!home.path(".omp").exists());
    }
}

#[test]
fn claude_directory_is_trimmed_and_empty_directory_overrides_use_defaults() {
    let home = Home::new();
    success(&home.install(
        "claude",
        &[("CLAUDE_CONFIG_DIR", Path::new("  custom_claude  "))],
    ));
    assert_eq!(
        std::fs::read_to_string(home.path("custom_claude/skills/geek/SKILL.md")).unwrap(),
        SKILL_MD
    );
    let home = Home::new();
    let overrides = [
        ("CLAUDE_CONFIG_DIR", Path::new(" ")),
        ("CODEX_HOME", Path::new("")),
        ("PI_CODING_AGENT_DIR", Path::new("")),
    ];
    let value = success(&home.install("all", &overrides));
    let expected = [
        home.path(".claude/skills/geek/SKILL.md"),
        home.path(".codex/skills/geek/SKILL.md"),
        home.path(".omp/agent/skills/geek/SKILL.md"),
    ];
    assert_eq!(value["data"]["installed"], serde_json::json!(expected));
}

#[test]
fn installation_does_not_read_or_repair_account_credentials() {
    let home = Home::new();
    for config in [".config", "Library/Application Support", "AppData/Roaming"] {
        let file = home.path(config).join("geek/credentials");
        std::fs::create_dir_all(file.parent().unwrap()).unwrap();
        std::fs::write(file, "owner malformed credentials").unwrap();
    }
    let value = success(&home.install("omp", &[]));
    assert_eq!(value["data"]["installed"].as_array().unwrap().len(), 1);
    for config in [".config", "Library/Application Support", "AppData/Roaming"] {
        assert_eq!(
            std::fs::read_to_string(home.path(config).join("geek/credentials")).unwrap(),
            "owner malformed credentials"
        );
    }
}

#[test]
fn concurrent_installs_create_each_skill_exactly_once() {
    let home = Home::new();
    let outputs = std::thread::scope(|scope| {
        let handles: Vec<_> = (0..4)
            .map(|_| scope.spawn(|| home.install("all", &[])))
            .collect();
        handles
            .into_iter()
            .map(|handle| handle.join().unwrap())
            .collect::<Vec<_>>()
    });
    let mut created = Vec::new();
    let mut skipped = 0;
    for output in outputs {
        let value = success(&output);
        created.extend(
            value["data"]["installed"]
                .as_array()
                .unwrap()
                .iter()
                .cloned(),
        );
        skipped += value["data"]["skipped"].as_array().unwrap().len();
    }
    assert_eq!(created.len(), 3);
    assert_eq!(skipped, 9);
    created.sort_by_key(|path| path.as_str().unwrap().to_owned());
    created.dedup();
    assert_eq!(created.len(), 3);
    for file in created {
        assert_eq!(
            std::fs::read_to_string(file.as_str().unwrap()).unwrap(),
            SKILL_MD
        );
    }
}

#[test]
fn filesystem_failures_are_reported_as_json_with_exit_one() {
    let home = Home::new();
    std::fs::write(home.path(".omp"), "not a directory").unwrap();
    let output = home.install("omp", &[]);
    assert_eq!(output.status.code(), Some(1));
    let value: Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(value["ok"], false);
    assert_eq!(value["error"]["code"], "skill_install_failed");
    assert_eq!(
        std::fs::read_to_string(home.path(".omp")).unwrap(),
        "not a directory"
    );
}
