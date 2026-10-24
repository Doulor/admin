// 旧吉祥物退役（#275，SPEC §4.6）：八张姿势图、悬浮小人组件、样式和配置都删掉，极客娘只用开机动画里的形象
// （app/web/sites/portal/assets/mascot/geek-girl.webp）。这里把验收用的 grep 写成测试，之后有人加回来会直接失败。
// 两个关键词拆开拼，免得这个文件自己命中验收时的 grep。
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const OLD_POSE_PATH = ["mascot", "pose-"].join("/");
const OLD_COMPONENT = ["Mas", "cot"].join("");
const TEXT = /\.(?:[cm]?[jt]sx?|vue|css|json|md|html|ya?ml)$/;

describe("旧吉祥物已经删干净", () => {
  it("app 与 tests 里没有旧姿势图路径，也没有旧组件名", () => {
    const files = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "app", "tests"], { cwd: ROOT, encoding: "utf8" })
      .split("\0")
      .filter((file) => TEXT.test(file) && existsSync(`${ROOT}${file}`));
    expect(files.length).toBeGreaterThan(100);
    const hits = files.filter((file) => {
      const text = readFileSync(`${ROOT}${file}`, "utf8");
      return text.includes(OLD_POSE_PATH) || text.includes(OLD_COMPONENT);
    });
    expect(hits).toEqual([]);
  });

  it("姿势图目录、配置里的吉祥物段和三个开关都不在了", () => {
    expect(existsSync(`${ROOT}app/web/public/mascot`)).toBe(false);
    const config = JSON.parse(readFileSync(`${ROOT}app/web/shared/config/app.config.json`, "utf8"));
    expect(config).not.toHaveProperty("mascot");
    for (const env of ["development", "production"]) {
      for (const flag of ["mascot", `forum${OLD_COMPONENT}`, "mascotPreview"]) expect(config.features[env]).not.toHaveProperty(flag);
    }
  });
});
