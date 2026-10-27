use std::io::{Read, Write};
use std::net::TcpListener;
use std::process::Command;
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

fn serve_json(responses: Vec<(&'static str, &'static str)>) -> (String, thread::JoinHandle<()>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let origin = format!("http://{}", listener.local_addr().unwrap());
    listener.set_nonblocking(true).unwrap();
    let server = thread::spawn(move || {
        for (path, body) in responses {
            let deadline = Instant::now() + Duration::from_secs(10);
            let mut stream = loop {
                match listener.accept() {
                    Ok((stream, _)) => break stream,
                    Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                        assert!(Instant::now() < deadline, "missing HTTP request: {path}");
                        thread::sleep(Duration::from_millis(10));
                    }
                    Err(error) => panic!("{error}"),
                }
            };
            stream.set_nonblocking(false).unwrap();
            stream
                .set_read_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            let mut request = Vec::new();
            let mut buf = [0; 4096];
            while !request.windows(4).any(|part| part == b"\r\n\r\n") {
                let size = stream.read(&mut buf).unwrap();
                assert!(size > 0);
                request.extend_from_slice(&buf[..size]);
            }
            let request = String::from_utf8_lossy(&request);
            assert!(request.starts_with(&format!("GET {path} HTTP/1.1")));
            write!(
                stream,
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            ).unwrap();
        }
    });
    (origin, server)
}

fn serve_error(status: u16, body: &'static str) -> (String, thread::JoinHandle<()>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let origin = format!("http://{}", listener.local_addr().unwrap());
    listener.set_nonblocking(true).unwrap();
    let server = thread::spawn(move || {
        let deadline = Instant::now() + Duration::from_secs(10);
        let mut stream = loop {
            match listener.accept() {
                Ok((stream, _)) => break stream,
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                    assert!(Instant::now() < deadline, "missing HTTP request");
                    thread::sleep(Duration::from_millis(10));
                }
                Err(error) => panic!("{error}"),
            }
        };
        stream.set_nonblocking(false).unwrap();
        stream
            .set_read_timeout(Some(Duration::from_secs(5)))
            .unwrap();
        let mut request = Vec::new();
        let mut buf = [0; 4096];
        while !request.windows(4).any(|part| part == b"\r\n\r\n") {
            let size = stream.read(&mut buf).unwrap();
            assert!(size > 0);
            request.extend_from_slice(&buf[..size]);
        }
        let request = String::from_utf8_lossy(&request);
        assert!(request.starts_with("GET /auth/device/userinfo HTTP/1.1"));
        write!(
            stream,
            "HTTP/1.1 {status} Test\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        )
        .unwrap();
    });
    (origin, server)
}

#[test]
fn whoami_uses_public_userinfo_even_when_console_has_stale_profile() {
    let (origin, server) = serve_json(vec![
        (
            "/auth/device/userinfo",
            r#"{"account_id":"account-1","sub":"account-1","login":"github-login","username":"canonical_handle","display_name":"统一昵称","bio":"统一简介","avatar_url":"/api/identity/avatar/current.webp","scope":"openid profile","email_required":false,"profile_required":false}"#,
        ),
        (
            "/api/console/me",
            r#"{"display_name":"旧控制台昵称","avatar_url":"https://stale.example/avatar.png","department":{"name":"技术部"}}"#,
        ),
    ]);
    let result = Command::new(env!("CARGO_BIN_EXE_geek"))
        .args(["whoami", "--json"])
        .env("GEEK_ORIGIN", &origin)
        .env("GEEK_TOKEN", "isolated-fixture-token")
        .env("NO_COLOR", "1")
        .output()
        .unwrap();
    server.join().unwrap();
    assert!(
        result.status.success(),
        "{}",
        String::from_utf8_lossy(&result.stderr)
    );
    let body: serde_json::Value = serde_json::from_slice(&result.stdout).unwrap();
    assert_eq!(body["data"]["nickname"], "统一昵称");
    assert_eq!(body["data"]["username"], "canonical_handle");
    assert_eq!(body["data"]["bio"], "统一简介");
    assert_eq!(
        body["data"]["avatar_url"],
        "/api/identity/avatar/current.webp"
    );
    assert_eq!(body["data"]["login"], "github-login");
    assert_eq!(body["data"]["account_id"], "account-1");
    assert_eq!(body["data"]["department"], "技术部");
    assert!(body["data"].get("real_name").is_none());
    assert!(body["data"].get("email").is_none());
}

#[test]
fn whoami_uses_public_userinfo_without_console_when_profile_gate_is_set() {
    let (origin, server) = serve_json(vec![(
        "/auth/device/userinfo",
        r#"{"account_id":"account-1","sub":"account-1","login":"github-login","username":"gated_handle","display_name":"资料关口昵称","bio":"资料关口简介","avatar_url":null,"scope":"openid profile","email_required":false,"profile_required":true}"#,
    )]);
    let result = Command::new(env!("CARGO_BIN_EXE_geek"))
        .args(["whoami", "--json"])
        .env("GEEK_ORIGIN", &origin)
        .env("GEEK_TOKEN", "isolated-fixture-token")
        .env("NO_COLOR", "1")
        .output()
        .unwrap();
    server.join().unwrap();
    assert!(
        result.status.success(),
        "{}",
        String::from_utf8_lossy(&result.stderr)
    );
    let body: serde_json::Value = serde_json::from_slice(&result.stdout).unwrap();
    assert_eq!(body["data"]["nickname"], "资料关口昵称");
    assert_eq!(body["data"]["username"], "gated_handle");
    assert_eq!(body["data"]["bio"], "资料关口简介");
    assert_eq!(body["data"]["profile_required"], true);
}

#[test]
fn whoami_preserves_legacy_console_nickname_when_userinfo_has_no_public_profile() {
    let (origin, server) = serve_json(vec![
        (
            "/auth/device/userinfo",
            r#"{"account_id":"account-1","sub":"account-1","login":"github-login","avatar_url":null,"scope":"openid profile","email_required":false,"profile_required":false}"#,
        ),
        (
            "/api/console/me",
            r#"{"display_name":"旧服务昵称","real_name":"不可公开姓名","department":{"name":"技术部"}}"#,
        ),
    ]);
    let result = Command::new(env!("CARGO_BIN_EXE_geek"))
        .args(["whoami", "--json"])
        .env("GEEK_ORIGIN", &origin)
        .env("GEEK_TOKEN", "isolated-fixture-token")
        .env("NO_COLOR", "1")
        .output()
        .unwrap();
    server.join().unwrap();
    assert!(result.status.success());
    let body: serde_json::Value = serde_json::from_slice(&result.stdout).unwrap();
    assert_eq!(body["data"]["nickname"], "旧服务昵称");
    assert_eq!(body["data"]["login"], "github-login");
    assert_eq!(body["data"]["department"], "技术部");
    assert!(!String::from_utf8_lossy(&result.stdout).contains("不可公开姓名"));
    assert!(body["data"].get("real_name").is_none());
}

#[test]
fn whoami_keeps_existing_http_error_exit_codes() {
    for (status, expected_exit, code) in [
        (401, 3, "invalid_token"),
        (403, 4, "forbidden"),
        (429, 5, "rate_limited"),
        (500, 1, "server_error"),
    ] {
        let body =
            Box::leak(format!(r#"{{"error":"{code}","message":"fixture"}}"#).into_boxed_str());
        let (origin, server) = serve_error(status, body);
        let result = Command::new(env!("CARGO_BIN_EXE_geek"))
            .args(["whoami", "--json"])
            .env("GEEK_ORIGIN", &origin)
            .env("GEEK_TOKEN", "isolated-fixture-token")
            .env("NO_COLOR", "1")
            .output()
            .unwrap();
        server.join().unwrap();
        assert_eq!(
            result.status.code(),
            Some(expected_exit),
            "HTTP {status}: {}",
            String::from_utf8_lossy(&result.stderr)
        );
        let response: serde_json::Value = serde_json::from_slice(&result.stdout).unwrap();
        assert_eq!(response["ok"], false);
        assert_eq!(response["error"]["code"], code);
    }
}

/// 外部 HTTP 夹具只验证真实 CLI 消费者；真实后端另由内存 buildApp 的 HTTP 验收覆盖。
fn login_with_avatar(avatar: &str, image_status: u16) -> (serde_json::Value, Vec<String>) {
    login_with_profile(
        avatar,
        image_status,
        serde_json::json!({
            "login": "provider-login", "display_name": "统一欢迎昵称", "profile_required": true,
        }),
        None,
    )
}

fn login_with_profile(
    avatar: &str,
    image_status: u16,
    mut userinfo: serde_json::Value,
    console: Option<serde_json::Value>,
) -> (serde_json::Value, Vec<String>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let origin = format!("http://{}", listener.local_addr().unwrap());
    listener.set_nonblocking(true).unwrap();
    let avatar = avatar
        .replace("{origin}", &origin)
        .replace("{host}", origin.trim_start_matches("http://"));
    userinfo["avatar_url"] = serde_json::Value::String(avatar);
    let received = Arc::new(Mutex::new(Vec::new()));
    let requests = received.clone();
    let (stop, stopped) = mpsc::channel();
    let server_origin = origin.clone();
    let server = thread::spawn(move || {
        let deadline = Instant::now() + Duration::from_secs(10);
        loop {
            let mut stream = match listener.accept() {
                Ok((stream, _)) => stream,
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                    if stopped.try_recv().is_ok() || Instant::now() >= deadline {
                        break;
                    }
                    thread::sleep(Duration::from_millis(10));
                    continue;
                }
                Err(error) => panic!("{error}"),
            };
            stream.set_nonblocking(false).unwrap();
            stream
                .set_read_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            let mut bytes = Vec::new();
            let mut buf = [0; 4096];
            while !bytes.windows(4).any(|part| part == b"\r\n\r\n") {
                let size = stream.read(&mut buf).unwrap();
                assert!(size > 0);
                bytes.extend_from_slice(&buf[..size]);
            }
            let request = String::from_utf8_lossy(&bytes);
            let path = request.split_whitespace().nth(1).unwrap().to_string();
            requests.lock().unwrap().push(path.clone());
            let (status, body) = match path.as_str() {
                "/auth/device/code" => (200, serde_json::json!({
                    "device_code": "fixture-device", "user_code": "BCDF-GHJK",
                    "verification_uri": format!("{server_origin}/device"),
                    "verification_uri_complete": format!("{server_origin}/device?user_code=BCDF-GHJK"),
                    "expires_in": 10, "interval": 1,
                }).to_string()),
                "/auth/device/token" => (200, r#"{"access_token":"fixture-token","scope":"openid profile","account_id":"account-1"}"#.to_string()),
                "/auth/device/userinfo" => (200, userinfo.to_string()),
                "/api/console/me" => (200, console.as_ref().expect("gated account must not fetch console profile").to_string()),
                "/api/identity/avatar/current.webp" => {
                    assert!(!request.to_ascii_lowercase().contains("authorization:"));
                    (image_status, "not an image".to_string())
                }
                _ => panic!("unexpected request: {path}"),
            };
            write!(stream, "HTTP/1.1 {status} Test\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).unwrap();
        }
    });
    let home = std::env::temp_dir().join(format!(
        "geek-profile-{}-{}",
        std::process::id(),
        origin.rsplit(':').next().unwrap()
    ));
    std::fs::create_dir_all(&home).unwrap();
    let result = Command::new(env!("CARGO_BIN_EXE_geek"))
        .args(["login", "--json", "--no-browser"])
        .env("GEEK_ORIGIN", origin)
        .env("HOME", &home)
        .env("XDG_CONFIG_HOME", home.join(".config"))
        .env("GEEK_NO_KEYRING", "1")
        .env_remove("GEEK_TOKEN")
        .env("NO_COLOR", "1")
        .output()
        .unwrap();
    stop.send(()).unwrap();
    server.join().unwrap();
    std::fs::remove_dir_all(home).unwrap();
    assert!(
        result.status.success(),
        "{}",
        String::from_utf8_lossy(&result.stderr)
    );
    let result = serde_json::from_slice(&result.stdout).unwrap();
    let requests = received.lock().unwrap().clone();
    (result, requests)
}

#[test]
fn login_preserves_legacy_console_nickname_when_userinfo_has_no_public_profile() {
    let (result, _) = login_with_profile(
        "",
        200,
        serde_json::json!({
            "login": "provider-login", "profile_required": false, "email_required": false,
        }),
        Some(serde_json::json!({
            "display_name": "旧欢迎昵称", "real_name": "不可公开姓名", "department": { "name": "技术部" },
        })),
    );
    assert_eq!(result["data"]["nickname"], "旧欢迎昵称");
    assert_eq!(result["data"]["department"], "技术部");
    assert!(!result.to_string().contains("不可公开姓名"));
    assert!(result["data"].get("real_name").is_none());
}

#[test]
fn login_resolves_relative_avatar_at_actual_origin_even_when_profile_is_gated() {
    let (result, requests) = login_with_avatar("/api/identity/avatar/current.webp", 200);
    assert_eq!(result["data"]["nickname"], "统一欢迎昵称");
    assert_eq!(result["data"]["profile_required"], true);
    assert!(requests
        .iter()
        .any(|path| path == "/api/identity/avatar/current.webp"));
}

#[test]
fn login_rejects_ambiguous_network_paths_and_credentials_without_breaking_login() {
    for url in [
        " //{host}/api/identity/avatar/current.webp",
        "//{host}/api/identity/avatar/current.webp",
        "http://name:password@{host}/api/identity/avatar/current.webp",
        "javascript:alert(1)",
        "data:image/png;base64,AAA",
        "file:///tmp/avatar.png",
        "/\\{host}/api/identity/avatar/current.webp",
    ] {
        let (result, requests) = login_with_avatar(url, 200);
        assert_eq!(result["ok"], true);
        assert_eq!(result["data"]["nickname"], "统一欢迎昵称");
        assert!(
            !requests
                .iter()
                .any(|path| path.starts_with("/api/identity/avatar/")),
            "accepted {url}"
        );
    }
}

#[test]
fn login_accepts_absolute_avatar_and_tolerates_failed_images() {
    for status in [200, 404, 500] {
        let (result, requests) =
            login_with_avatar("{origin}/api/identity/avatar/current.webp", status);
        assert_eq!(result["ok"], true);
        assert_eq!(result["data"]["nickname"], "统一欢迎昵称");
        assert!(requests
            .iter()
            .any(|path| path == "/api/identity/avatar/current.webp"));
    }
}
