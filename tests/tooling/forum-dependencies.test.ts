import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dependencyProblems } from "../../scripts/forum-dependencies.mjs";

// 论坛的 package.json 与 pnpm-lock.yaml 只能比上游多出所有者逐个批准、写死版本的依赖，
// 锁文件要是审过的那一份（app/forum/ADOPTION.json 的 approvedDependencies，#276）。下面的清单与锁文件是编出来的。
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
const manifest = (dependencies: Record<string, string>, extra: Record<string, unknown> = {}) =>
  json({ name: "tuff-forum", private: true, ...extra, dependencies: { "@iconify-json/ri": "1.2.10", ...dependencies, vue: "3.5.42" }, devDependencies: { vitest: "3.2.7" } });
const lockfile = (extra = "") =>
  `lockfileVersion: '9.0'\n\nimporters:\n\n  .:\n    dependencies:\n      '@iconify-json/ri':\n        specifier: 1.2.10\n        version: 1.2.10\n${extra}      vue:\n        specifier: 3.5.42\n        version: 3.5.42(typescript@5.9.3)\n`;
const crepeEntry = (version = "7.22.3") => `      '@milkdown/crepe':\n        specifier: ${version}\n        version: ${version}(prosemirror-model@1.25.12)\n`;

const upstreamManifest = manifest({});
const upstreamLockfile = lockfile();
const upstream = { "package.json": sha(upstreamManifest), "pnpm-lock.yaml": sha(upstreamLockfile) };
const crepeManifest = manifest({ "@milkdown/crepe": "7.22.3" });
const crepeLockfile = lockfile(crepeEntry());
const approved = (over: Record<string, unknown> = {}) => ({
  approval: "所有者 2026-10-23 批准引入",
  dependencies: { "@milkdown/crepe": "7.22.3" },
  lockfileSha256: sha(crepeLockfile),
  ...over,
});

describe("论坛依赖只认批准过的", () => {
  it("和上游一模一样时不需要批准", () => {
    expect(dependencyProblems({ manifest: upstreamManifest, lockfile: upstreamLockfile, upstream, approved: undefined })).toEqual([]);
  });

  it("没有批准就改了清单或锁文件，拦下", () => {
    expect(dependencyProblems({ manifest: crepeManifest, lockfile: upstreamLockfile, upstream, approved: undefined })).toHaveLength(1);
    expect(dependencyProblems({ manifest: upstreamManifest, lockfile: crepeLockfile, upstream, approved: undefined })).toHaveLength(1);
  });

  it("批准的依赖、写死的版本、审过的锁文件，通过", () => {
    expect(dependencyProblems({ manifest: crepeManifest, lockfile: crepeLockfile, upstream, approved: approved() })).toEqual([]);
  });

  it("多加一个没批准的依赖，拦下", () => {
    const problems = dependencyProblems({ manifest: manifest({ "@milkdown/crepe": "7.22.3", "left-pad": "1.3.0" }), lockfile: crepeLockfile, upstream, approved: approved() });
    expect(problems).toEqual(["package.json differs from upstream beyond the approved dependencies"]);
  });

  it("清单里别的地方改了（脚本、版本号、开发依赖），拦下", () => {
    const problems = dependencyProblems({ manifest: manifest({ "@milkdown/crepe": "7.22.3" }, { scripts: { postinstall: "node x.js" } }), lockfile: crepeLockfile, upstream, approved: approved() });
    expect(problems).toEqual(["package.json differs from upstream beyond the approved dependencies"]);
  });

  it("版本范围（^、~）不算写死，批准里和清单里都不行", () => {
    const problems = dependencyProblems({
      manifest: manifest({ "@milkdown/crepe": "^7.22.3" }),
      lockfile: lockfile(crepeEntry("^7.22.3")),
      upstream,
      approved: approved({ dependencies: { "@milkdown/crepe": "^7.22.3" }, lockfileSha256: sha(lockfile(crepeEntry("^7.22.3"))) }),
    });
    expect(problems).toEqual(['@milkdown/crepe: the approved version must be exact (x.y.z), not "^7.22.3"']);
  });

  it("清单里的版本和批准的不一样，拦下", () => {
    const problems = dependencyProblems({ manifest: manifest({ "@milkdown/crepe": "7.22.4" }), lockfile: crepeLockfile, upstream, approved: approved() });
    expect(problems).toContain('@milkdown/crepe: package.json has "7.22.4", approved "7.22.3"');
  });

  it("批准了却没加进清单，拦下", () => {
    const problems = dependencyProblems({ manifest: upstreamManifest, lockfile: crepeLockfile, upstream, approved: approved() });
    expect(problems).toContain('@milkdown/crepe: package.json has null, approved "7.22.3"');
  });

  it("锁文件在审过之后又变了，拦下", () => {
    const later = `${crepeLockfile}\n  left-pad@1.3.0: {}\n`;
    const problems = dependencyProblems({ manifest: crepeManifest, lockfile: later, upstream, approved: approved() });
    expect(problems).toEqual(["pnpm-lock.yaml is not the reviewed lockfile (approvedDependencies.lockfileSha256)"]);
  });

  it("锁文件给这个依赖解析出别的版本，拦下", () => {
    const other = lockfile(crepeEntry("7.21.0"));
    const problems = dependencyProblems({ manifest: crepeManifest, lockfile: other, upstream, approved: approved({ lockfileSha256: sha(other) }) });
    expect(problems).toEqual(["@milkdown/crepe: pnpm-lock.yaml does not resolve 7.22.3 for the forum"]);
  });

  it("批准要写明谁、什么时候批的，依赖清单不能是空的", () => {
    expect(dependencyProblems({ manifest: crepeManifest, lockfile: crepeLockfile, upstream, approved: approved({ approval: " " }) }))
      .toContain("approvedDependencies.approval must say who approved the dependencies and when");
    expect(dependencyProblems({ manifest: upstreamManifest, lockfile: crepeLockfile, upstream, approved: approved({ dependencies: {} }) }))
      .toContain("approvedDependencies.dependencies is empty");
  });

  it("仓库里的论坛清单与锁文件按 ADOPTION.json 通过", () => {
    const read = (name: string) => readFileSync(new URL(`../../app/forum/${name}`, import.meta.url), "utf8");
    const { original_files } = JSON.parse(read("UPSTREAM.json"));
    const { approvedDependencies } = JSON.parse(read("ADOPTION.json"));
    expect(dependencyProblems({ manifest: read("package.json"), lockfile: read("pnpm-lock.yaml"), upstream: original_files, approved: approvedDependencies })).toEqual([]);
  });
});
