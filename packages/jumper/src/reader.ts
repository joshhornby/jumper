import { type Diagnostic, type DiagnosticCode, diagnostic, type Related, type Span } from "./diagnostics.ts";

export type Expr =
  | { kind: "list"; items: Expr[]; span: Span }
  | { kind: "symbol"; name: string; span: Span }
  | { kind: "keyword"; name: string; span: Span }
  | { kind: "string"; value: string; span: Span };

/** A `;` comment. The text keeps the `;` and drops trailing spaces. */
export type Comment = { text: string; span: Span };

/** Comments are kept apart from the tree, so that the compiler ignores them and the printer can keep them. */
export type ReadResult = { exprs: Expr[]; comments: Comment[]; diagnostics: Diagnostic[] };

class SyntaxFault extends Error {
  readonly code: DiagnosticCode;
  readonly span: Span;
  readonly related: Related[];
  constructor({ code, message, span, related = [] }: { code: DiagnosticCode; message: string; span: Span; related?: Related[] }) {
    super(message);
    this.code = code;
    this.span = span;
    this.related = related;
  }
}

/** An open list, with the column of its parenthesis. */
type Open = { start: number; line: number; column: number };

const DELIMITERS = new Set(["(", ")", '"', ";"]);

function isSpace(char: string): boolean {
  return char === " " || char === "\n" || char === "\t" || char === "\r";
}

export function read(source: string): ReadResult {
  let position = 0;
  const comments: Comment[] = [];

  const lineStarts = [0];
  for (let index = 0; index < source.length; index += 1) if (source[index] === "\n") lineStarts.push(index + 1);
  const lineOf = (offset: number): number => {
    let low = 0;
    let high = lineStarts.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if ((lineStarts[middle] ?? 0) <= offset) low = middle;
      else high = middle - 1;
    }
    return low;
  };

  /**
   * A missing parenthesis is reported at the end of the file, far from the mistake. Indentation says more:
   * when a line starts a list at the same depth as a list that is still open, that open list most likely
   * should have closed before the line. The first such list is kept, to report in place of the outer one.
   */
  const open: Open[] = [];
  let suspect: { list: Open; parent: Open | null; before: number } | null = null;

  const skipTrivia = (): void => {
    while (position < source.length) {
      const char = source[position] ?? "";
      if (isSpace(char)) {
        position += 1;
      } else if (char === ";") {
        const start = position;
        while (position < source.length && source[position] !== "\n") position += 1;
        comments.push({ text: source.slice(start, position).trimEnd(), span: { start, end: position } });
      } else {
        return;
      }
    }
  };

  const readString = (): Expr => {
    const start = position;
    position += 1;
    let value = "";
    while (position < source.length) {
      const char = source[position] ?? "";
      if (char === '"') {
        position += 1;
        return { kind: "string", value, span: { start, end: position } };
      }
      if (char === "\\") {
        const next = source[position + 1] ?? "";
        value += next === "n" ? "\n" : next;
        position += 2;
        continue;
      }
      value += char;
      position += 1;
    }
    throw new SyntaxFault({
      code: "unclosed-string",
      message: "This string has no closing quote.",
      span: { start, end: source.length },
    });
  };

  const readAtom = (): Expr => {
    const start = position;
    while (position < source.length) {
      const char = source[position] ?? "";
      if (isSpace(char) || DELIMITERS.has(char)) break;
      position += 1;
    }
    const text = source.slice(start, position);
    const span = { start, end: position };
    if (text.startsWith(":") && text.length > 1) {
      return { kind: "keyword", name: text.slice(1), span };
    }
    return { kind: "symbol", name: text, span };
  };

  const readExpr = (): Expr => {
    const char = source[position];
    if (char === "(") {
      const start = position;
      const line = lineOf(start);
      const lineStart = lineStarts[line] ?? 0;
      const column = start - lineStart;
      if (suspect === null && source.slice(lineStart, start).trim() === "") {
        const index = open.findLastIndex((list) => list.column >= column && list.line < line);
        const list = open[index];
        if (list !== undefined) suspect = { list, parent: open[index - 1] ?? null, before: start };
      }
      open.push({ start, line, column });
      position += 1;
      const items: Expr[] = [];
      for (;;) {
        skipTrivia();
        if (position >= source.length) {
          if (suspect !== null) {
            const at = suspect.before;
            throw new SyntaxFault({
              code: "unclosed-list",
              message: "This list has no closing parenthesis.",
              span: { start: suspect.list.start, end: suspect.list.start + 1 },
              related: [
                {
                  span: { start: at, end: at + 1 },
                  message: `It most likely ends before line ${lineOf(at) + 1}, which starts at the same depth.`,
                },
              ],
            });
          }
          throw new SyntaxFault({
            code: "unclosed-list",
            message: "This list has no closing parenthesis.",
            span: { start, end: start + 1 },
          });
        }
        if (source[position] === ")") {
          const closed = open.pop();
          // The suspect may close by taking a later list's parenthesis. Only when its parent closes is the mistake ruled out.
          if (suspect !== null && closed === (suspect.parent ?? suspect.list)) suspect = null;
          position += 1;
          return { kind: "list", items, span: { start, end: position } };
        }
        items.push(readExpr());
      }
    }
    if (char === ")") {
      throw new SyntaxFault({
        code: "unmatched-paren",
        message: "This closing parenthesis has no matching opening parenthesis.",
        span: { start: position, end: position + 1 },
      });
    }
    if (char === '"') return readString();
    return readAtom();
  };

  const exprs: Expr[] = [];
  try {
    for (;;) {
      skipTrivia();
      if (position >= source.length) break;
      exprs.push(readExpr());
    }
  } catch (fault) {
    if (fault instanceof SyntaxFault) {
      return {
        exprs: [],
        comments,
        diagnostics: [diagnostic({ code: fault.code, message: fault.message, span: fault.span, related: fault.related })],
      };
    }
    throw fault;
  }
  return { exprs, comments, diagnostics: [] };
}

/** Writes `text` as a Jumper string literal. `read` gives back the same text. */
export function quote(text: string): string {
  return `"${text.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("\n", "\\n")}"`;
}
