// 终端的命令行解析（#279）：照 bash 的规则切词，单引号原样、双引号里展开 $变量 和 $(命令)，反斜杠转义一个字符，
// 支持 | 管道、> >> < 2> 2>> 2>&1 &> 重定向、&& || ; 连接、# 注释、行首的 NAME=值 赋值。
// 这里只产出语法树，变量什么时候展开由 index.ts 在执行到那一条命令时决定（a=1; echo $a 要能拿到 1）。

/** 词的一段：lit 是字面文字（quoted 时不参与通配和 ~ 展开），var 是 $NAME，sub 是 $(...)，arith 是 $((...)) */
export type Segment =
  | { kind: "lit"; text: string; quoted: boolean }
  | { kind: "var"; name: string; quoted: boolean }
  | { kind: "sub"; source: string; quoted: boolean }
  | { kind: "arith"; source: string; quoted: boolean };
export type Word = Segment[];

export type Redirect = { fd: 1 | 2 | "both"; op: ">" | ">>"; target: Word } | { fd: 0; op: "<"; target: Word } | { fd: 2; op: "dup" };

export type Command = { assigns: Array<{ name: string; value: Word }>; words: Word[]; redirects: Redirect[] };
export type Pipeline = Command[];
export type Chain = Array<{ pipeline: Pipeline; next: "&&" | "||" | ";" | null }>;

export class ParseError extends Error {}

type Token = { type: "word"; word: Word } | { type: "op"; op: string };

const OPERATORS = ["2>&1", "&>", "2>>", "2>", ">>", "&&", "||", ">", "<", "|", ";", "&"];

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let word: Word | null = null;
  const pushLit = (text: string, quoted: boolean) => {
    word ??= [];
    const last = word[word.length - 1];
    if (last?.kind === "lit" && last.quoted === quoted) last.text += text;
    else word.push({ kind: "lit", text, quoted });
  };
  const endWord = () => {
    if (word) tokens.push({ type: "word", word });
    word = null;
  };
  // $NAME、${NAME}、$?、$$、$#、$@、$1、$(...)、$((...))；没有变量名的 $ 照字面
  const dollar = (quoted: boolean) => {
    const rest = input.slice(i + 1);
    if (rest.startsWith("((")) {
      // 里面还能有括号：数到和开头配对的 )) 为止
      let depth = 0;
      let end = -1;
      for (let j = i + 3; j < input.length; j += 1) {
        if (input[j] === "(") depth += 1;
        else if (input[j] === ")") {
          if (depth === 0 && input[j + 1] === ")") {
            end = j;
            break;
          }
          depth -= 1;
        }
      }
      if (end < 0) throw new ParseError("bash: unexpected EOF while looking for matching `))'");
      word ??= [];
      word.push({ kind: "arith", source: input.slice(i + 3, end), quoted });
      i = end + 2;
      return;
    }
    if (rest.startsWith("(")) {
      let depth = 0;
      let j = i + 1;
      let quote: string | null = null;
      for (; j < input.length; j += 1) {
        const c = input[j];
        if (quote) {
          if (c === quote) quote = null;
        } else if (c === "'" || c === '"') quote = c;
        else if (c === "(") depth += 1;
        else if (c === ")" && --depth === 0) break;
      }
      if (j >= input.length) throw new ParseError("bash: unexpected EOF while looking for matching `)'");
      word ??= [];
      word.push({ kind: "sub", source: input.slice(i + 2, j), quoted });
      i = j + 1;
      return;
    }
    const braced = /^\{([A-Za-z_][A-Za-z0-9_]*|\?)\}/.exec(rest);
    const plain = /^([A-Za-z_][A-Za-z0-9_]*|[?$#@0-9])/.exec(rest);
    const match = braced ?? plain;
    if (!match) {
      pushLit("$", quoted);
      i += 1;
      return;
    }
    word ??= [];
    word.push({ kind: "var", name: match[1], quoted });
    i += 1 + match[0].length;
  };

  while (i < input.length) {
    const c = input[i];
    if (c === " " || c === "\t" || c === "\n") {
      endWord();
      i += 1;
    } else if (c === "#" && !word) {
      break;
    } else if (c === "'") {
      const end = input.indexOf("'", i + 1);
      if (end < 0) throw new ParseError("bash: unexpected EOF while looking for matching `''");
      pushLit(input.slice(i + 1, end), true);
      i = end + 1;
    } else if (c === '"') {
      i += 1;
      word ??= [];
      pushLit("", true);
      while (i < input.length && input[i] !== '"') {
        if (input[i] === "\\" && i + 1 < input.length && '"\\$`'.includes(input[i + 1])) {
          pushLit(input[i + 1], true);
          i += 2;
        } else if (input[i] === "$") dollar(true);
        else {
          pushLit(input[i], true);
          i += 1;
        }
      }
      if (i >= input.length) throw new ParseError('bash: unexpected EOF while looking for matching `"\'');
      i += 1;
    } else if (c === "\\") {
      if (i + 1 < input.length) pushLit(input[i + 1], true);
      i += 2;
    } else if (c === "$") {
      dollar(false);
    } else {
      const op = OPERATORS.find((candidate) => input.startsWith(candidate, i));
      // 2> 只有在词的开头才是重定向（a2>b 里的 2 是词的一部分）
      if (op && !(op.startsWith("2") && word)) {
        endWord();
        tokens.push({ type: "op", op });
        i += op.length;
      } else {
        pushLit(c, false);
        i += 1;
      }
    }
  }
  endWord();
  return tokens;
}

const ASSIGN = /^([A-Za-z_][A-Za-z0-9_]*)=/;

const CONTROL = new Set(["if", "for", "while", "until", "case", "select", "function"]);

export function parse(input: string): Chain {
  const tokens = tokenize(input);
  const chain: Chain = [];
  let command: Command = { assigns: [], words: [], redirects: [] };
  let pipeline: Pipeline = [];
  const near = (op: string) => new ParseError(`bash: syntax error near unexpected token \`${op}'`);
  const endCommand = (op: string) => {
    if (!command.words.length && !command.assigns.length && !command.redirects.length) throw near(op);
    pipeline.push(command);
    command = { assigns: [], words: [], redirects: [] };
  };
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.type === "word") {
      const first = token.word[0];
      const assign = !command.words.length && first?.kind === "lit" && !first.quoted ? ASSIGN.exec(first.text) : null;
      if (assign && first?.kind === "lit") {
        const rest: Word = [{ ...first, text: first.text.slice(assign[0].length) }, ...token.word.slice(1)].filter((seg) => seg.kind !== "lit" || seg.text || seg.quoted);
        command.assigns.push({ name: assign[1], value: rest });
      } else command.words.push(token.word);
      continue;
    }
    const { op } = token;
    if (op === "2>&1") {
      command.redirects.push({ fd: 2, op: "dup" });
    } else if (op === ">" || op === ">>" || op === "<" || op === "2>" || op === "2>>" || op === "&>") {
      const target = tokens[i + 1];
      if (target?.type !== "word") throw near(target?.type === "op" ? target.op : "newline");
      i += 1;
      if (op === "<") command.redirects.push({ fd: 0, op: "<", target: target.word });
      else if (op === "&>") command.redirects.push({ fd: "both", op: ">", target: target.word });
      else command.redirects.push({ fd: op.startsWith("2") ? 2 : 1, op: op.endsWith(">>") ? ">>" : ">", target: target.word });
    } else if (op === "|") {
      endCommand(op);
    } else if (op === "&&" || op === "||" || op === ";") {
      endCommand(op);
      chain.push({ pipeline, next: op });
      pipeline = [];
    } else if (op === "&") {
      throw new ParseError("bash: 这个终端不支持后台任务（&），去掉 & 直接运行");
    }
  }
  if (command.words.length || command.assigns.length || command.redirects.length) pipeline.push(command);
  if (pipeline.length) chain.push({ pipeline, next: null });
  else if (chain.length) {
    const last = chain[chain.length - 1];
    if (last.next === ";") last.next = null;
    else throw near("newline");
  }
  // 控制结构整行都不跑，免得 for 报完了 do、done 再各报一次 command not found
  for (const { pipeline: commands } of chain) {
    for (const { words } of commands) {
      const head = words[0]?.length === 1 && words[0][0].kind === "lit" && !words[0][0].quoted ? words[0][0].text : "";
      if (CONTROL.has(head)) throw new ParseError(`bash: ${head}: 这个终端不支持 if、for、while 这类控制结构，用 && 和 || 把命令串起来`);
    }
  }
  return chain;
}

/** 补全用的粗切：最后一个词（不管引号）和它前面的部分 */
export function lastWord(line: string): { head: string; word: string; first: boolean } {
  const match = /(^|[\s|;&<>])([^\s|;&<>]*)$/.exec(line) ?? { index: line.length, 1: "", 2: "" };
  const head = line.slice(0, line.length - match[2].length);
  const before = head.replace(/\s+$/, "");
  return { head, word: match[2], first: before === "" || /(\|\||&&|[|;])$/.test(before) };
}
