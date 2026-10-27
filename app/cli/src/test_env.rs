//! Environment tests run in their own process: libtest threads otherwise share HOME and credentials.
pub fn isolated(name: &str) -> bool {
    if std::env::var("GEEK_TEST_CHILD").as_deref() == Ok(name) {
        return true;
    }
    let home = std::env::temp_dir().join(format!(
        "geek-env-{}-{}",
        std::process::id(),
        name.replace("::", "_")
    ));
    std::fs::create_dir(&home).unwrap();
    let output = std::process::Command::new(std::env::current_exe().unwrap())
        .args(["--exact", name, "--test-threads=1"])
        .env_clear()
        .env("GEEK_TEST_CHILD", name)
        .env("GEEK_NO_KEYRING", "1")
        .env("HOME", &home)
        .env("USERPROFILE", &home)
        .env("XDG_CONFIG_HOME", home.join(".config"))
        .output()
        .unwrap();
    std::fs::remove_dir_all(home).unwrap();
    assert!(
        output.status.success(),
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(String::from_utf8_lossy(&output.stdout).contains("1 passed"));
    false
}
