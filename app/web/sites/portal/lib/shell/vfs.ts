// 终端的虚拟文件系统（#279）：整棵树在内存里，只有家目录里自己建的文件存进 localStorage（index.ts 负责读写）。
// 家目录和 /tmp 可写，其余目录只读，写进去报 Permission denied，和真 Linux 上普通用户一样。
// 桌面应用（~/Desktop/*.app）、代码仓库（~/projects）和系统目录是每次打开终端时生成的（generated），删了下次还在，也不存盘。

export type FileNode = { type: "file"; content: string; mode: number; mtime: number; generated?: boolean; builtin?: boolean };
export type DirNode = { type: "dir"; children: Map<string, FsNode>; mode: number; mtime: number; generated?: boolean };
export type FsNode = FileNode | DirNode;

export type FsCode = "ENOENT" | "ENOTDIR" | "EISDIR" | "EACCES" | "EEXIST" | "ENOTEMPTY" | "ENOSPC" | "EINVAL";

const MESSAGES: Record<FsCode, string> = {
  ENOENT: "No such file or directory",
  ENOTDIR: "Not a directory",
  EISDIR: "Is a directory",
  EACCES: "Permission denied",
  EEXIST: "File exists",
  ENOTEMPTY: "Directory not empty",
  ENOSPC: "No space left on device",
  EINVAL: "Invalid argument",
};

export class FsError extends Error {
  constructor(
    readonly code: FsCode,
    readonly path: string,
  ) {
    super(MESSAGES[code]);
  }
}

/** 家目录里自己写的内容最多这么多字符（存在 localStorage 里），超了报 No space left on device */
export const HOME_QUOTA = 100_000;

export const dir = (generated = false, mode = 0o755): DirNode => ({ type: "dir", children: new Map(), mode, mtime: Date.now(), generated });
export const file = (content: string, mode = 0o644, generated = false): FileNode => ({ type: "file", content, mode, mtime: Date.now(), generated });

export function basename(path: string): string {
  const trimmed = path.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed.slice(trimmed.lastIndexOf("/") + 1);
}

export function dirname(path: string): string {
  const trimmed = path.replace(/\/+$/, "");
  const at = trimmed.lastIndexOf("/");
  if (at < 0) return ".";
  return at === 0 ? "/" : trimmed.slice(0, at);
}

/** 通配符转正则：* ? [abc] [!abc]，反斜杠转义的字符照字面匹配；以 . 开头的名字只有模式也以 . 开头才匹配 */
export function globToRegExp(pattern: string): RegExp {
  let source = "";
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    if (char === "\\" && i + 1 < pattern.length) source += escapeRegExp(pattern[++i]);
    else if (char === "*") source += "[^/]*";
    else if (char === "?") source += "[^/]";
    else if (char === "[") {
      const end = pattern.indexOf("]", i + 2);
      if (end < 0) source += "\\[";
      else {
        let set = pattern.slice(i + 1, end);
        if (set.startsWith("!")) set = `^${set.slice(1)}`;
        source += `[${set.replace(/\\/g, "\\\\")}]`;
        i = end;
      }
    } else source += escapeRegExp(char);
  }
  return new RegExp(`^${source}$`);
}

export function hasGlob(pattern: string): boolean {
  return /(^|[^\\])[*?[]/.test(pattern);
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

export class Vfs {
  readonly root: DirNode = dir(true);

  constructor(
    readonly home: string,
    private readonly writableRoots: readonly string[] = [home, "/tmp"],
  ) {}

  /** 把 cwd 下的相对路径、~、.、.. 化成绝对路径（不检查存在） */
  resolve(path: string, cwd: string): string {
    let full = path;
    if (full === "~" || full.startsWith("~/")) full = this.home + full.slice(1);
    else if (!full.startsWith("/")) full = `${cwd}/${full}`;
    const parts: string[] = [];
    for (const part of full.split("/")) {
      if (!part || part === ".") continue;
      if (part === "..") parts.pop();
      else parts.push(part);
    }
    return `/${parts.join("/")}`;
  }

  /** 绝对路径化成提示符里的写法：家目录写成 ~ */
  pretty(path: string): string {
    if (path === this.home) return "~";
    return path.startsWith(`${this.home}/`) ? `~${path.slice(this.home.length)}` : path;
  }

  get(path: string): FsNode | null {
    let node: FsNode = this.root;
    for (const part of path.split("/").filter(Boolean)) {
      if (node.type !== "dir") return null;
      const next = node.children.get(part);
      if (!next) return null;
      node = next;
    }
    return node;
  }

  /** 自己的目录（家目录、/tmp）随便读；别人的（root）要看「其他人」那一位有没有 r */
  readable(path: string, node: FsNode): boolean {
    return this.writable(path) || (node.mode & 0o004) !== 0;
  }

  getDir(path: string): DirNode {
    const node = this.get(path);
    if (!node) throw new FsError("ENOENT", path);
    if (node.type !== "dir") throw new FsError("ENOTDIR", path);
    if (!this.readable(path, node)) throw new FsError("EACCES", path);
    return node;
  }

  read(path: string): string {
    const node = this.get(path);
    if (!node) throw new FsError("ENOENT", path);
    if (node.type === "dir") throw new FsError("EISDIR", path);
    if (!this.readable(path, node) || (this.writable(path) && !(node.mode & 0o400))) throw new FsError("EACCES", path);
    return node.content;
  }

  writable(path: string): boolean {
    return this.writableRoots.some((root) => path === root || path.startsWith(`${root}/`));
  }

  private parentOf(path: string): DirNode {
    const parent = this.get(dirname(path));
    if (!parent) throw new FsError("ENOENT", path);
    if (parent.type !== "dir") throw new FsError("ENOTDIR", path);
    return parent;
  }

  private assertWritable(path: string) {
    if (!this.writable(path) || path === this.home) throw new FsError("EACCES", path);
  }

  /** 家目录里自己写的字符数（生成的不算） */
  homeUsage(): number {
    const walk = (node: FsNode): number => {
      if (node.generated) return 0;
      if (node.type === "file") return node.content.length;
      let total = 0;
      for (const child of node.children.values()) total += walk(child) + 1;
      return total;
    };
    const home = this.get(this.home);
    return home ? walk(home) : 0;
  }

  write(path: string, content: string, append = false): void {
    const existing = this.get(path);
    if (existing?.type === "dir") throw new FsError("EISDIR", path);
    if (existing && !(existing.mode & 0o200)) throw new FsError("EACCES", path);
    this.assertWritable(path);
    const parent = this.parentOf(path);
    const next = append && existing ? existing.content + content : content;
    if (path.startsWith(`${this.home}/`) && this.homeUsage() - (existing && !existing.generated ? existing.content.length : 0) + next.length > HOME_QUOTA) {
      throw new FsError("ENOSPC", path);
    }
    if (existing) {
      existing.content = next;
      existing.mtime = Date.now();
      existing.generated = false;
    } else parent.children.set(basename(path), file(next));
    parent.mtime = Date.now();
  }

  touch(path: string): void {
    const existing = this.get(path);
    if (existing) {
      existing.mtime = Date.now();
      return;
    }
    this.write(path, "");
  }

  mkdir(path: string, parents = false): void {
    if (parents) {
      let current = "";
      for (const part of path.split("/").filter(Boolean)) {
        current += `/${part}`;
        const node = this.get(current);
        if (node?.type === "file") throw new FsError("ENOTDIR", current);
        if (!node) this.mkdir(current);
      }
      return;
    }
    if (this.get(path)) throw new FsError("EEXIST", path);
    this.assertWritable(path);
    const parent = this.parentOf(path);
    parent.children.set(basename(path), dir());
    parent.mtime = Date.now();
  }

  remove(path: string, recursive = false): void {
    const node = this.get(path);
    if (!node) throw new FsError("ENOENT", path);
    this.assertWritable(path);
    if (node.type === "dir" && !recursive) throw new FsError("EISDIR", path);
    this.parentOf(path).children.delete(basename(path));
  }

  rmdir(path: string): void {
    const node = this.getDir(path);
    if (node.children.size) throw new FsError("ENOTEMPTY", path);
    this.assertWritable(path);
    this.parentOf(path).children.delete(basename(path));
  }

  /** 复制一个节点到 to（to 是已有目录时放进去），目录要 recursive */
  copy(from: string, to: string, recursive = false): void {
    const source = this.get(from);
    if (!source) throw new FsError("ENOENT", from);
    if (source.type === "dir" && !recursive) throw new FsError("EISDIR", from);
    const target = this.get(to)?.type === "dir" ? `${to === "/" ? "" : to}/${basename(from)}` : to;
    if (target === from || target.startsWith(`${from}/`)) throw new FsError("EINVAL", to);
    this.assertWritable(target);
    const parent = this.parentOf(target);
    const clone = (node: FsNode): FsNode =>
      node.type === "file" ? { ...file(node.content, node.mode) } : { ...dir(false, node.mode), children: new Map([...node.children].map(([name, child]) => [name, clone(child)])) };
    if (source.type === "file") this.write(target, source.content);
    else parent.children.set(basename(target), clone(source));
    const copied = this.get(target);
    if (copied) copied.mode = source.mode;
  }

  move(from: string, to: string): void {
    const source = this.get(from);
    if (!source) throw new FsError("ENOENT", from);
    this.assertWritable(from);
    const target = this.get(to)?.type === "dir" ? `${to === "/" ? "" : to}/${basename(from)}` : to;
    if (target === from) return;
    if (target.startsWith(`${from}/`)) throw new FsError("EINVAL", to);
    this.assertWritable(target);
    const parent = this.parentOf(target);
    this.parentOf(from).children.delete(basename(from));
    source.generated = false;
    parent.children.set(basename(target), source);
  }

  chmod(path: string, mode: number): void {
    const node = this.get(path);
    if (!node) throw new FsError("ENOENT", path);
    this.assertWritable(path);
    node.mode = mode & 0o777;
  }

  /** 一个绝对路径模式（每一段都可以带通配符）匹配到的全部路径，按字母排序；没有匹配回空数组 */
  glob(pattern: string): string[] {
    const parts = pattern.split("/").filter(Boolean);
    let paths = ["/"];
    for (const part of parts) {
      const next: string[] = [];
      for (const base of paths) {
        const node = this.get(base);
        if (node?.type !== "dir") continue;
        const join = (name: string) => (base === "/" ? `/${name}` : `${base}/${name}`);
        if (!hasGlob(part)) {
          const name = part.replace(/\\(.)/g, "$1");
          if (name === "..") next.push(dirname(base));
          else if (name === ".") next.push(base);
          else if (node.children.has(name)) next.push(join(name));
          continue;
        }
        const re = globToRegExp(part);
        for (const name of [...node.children.keys()].sort()) {
          if (name.startsWith(".") && !part.startsWith(".")) continue;
          if (re.test(name)) next.push(join(name));
        }
      }
      paths = next;
    }
    return parts.length ? paths : [];
  }
}
