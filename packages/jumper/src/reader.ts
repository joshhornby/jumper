import { type Diagnostic, type DiagnosticCode, diagnostic, type Span } from "./diagnostics.ts";

export type Expr =
  | { kind: "list"; items: Expr[]; span: Span }
  | { kind: "symbol"; name: string; span: Span }
  | { kind: "keyword"; name: string; span: Span }
  | { kind: "string"; value: string; span: Span };

export type ReadResult = { exprs: Expr[]; diagnostics: Diagnostic[] };

class SyntaxFault extends Error {
  readonly code: DiagnosticCode;
  readonly span: Span;
  constructor({ code, message, span }: { code: DiagnosticCode; message: string; span: Span }) {
    super(message);
    this.code = code;
    this.span = span;
  }
}

const DELIMITERS = new Set(["(", ")", '"', ";"]);

function isSpace(char: string): boolean {
  return char === " " || char === "\n" || char === "\t" || char === "\r";
}

export function read(source: string): ReadResult {
  let position = 0;

  const skipTrivia = (): void => {
    while (position < source.length) {
      const char = source[position] ?? "";
      if (isSpace(char)) {
        position += 1;
      } else if (char === ";") {
        while (position < source.length && source[position] !== "\n") position += 1;
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
      position += 1;
      const items: Expr[] = [];
      for (;;) {
        skipTrivia();
        if (position >= source.length) {
          throw new SyntaxFault({
            code: "unclosed-list",
            message: "This list has no closing parenthesis.",
            span: { start, end: start + 1 },
          });
        }
        if (source[position] === ")") {
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
        diagnostics: [diagnostic({ code: fault.code, message: fault.message, span: fault.span })],
      };
    }
    throw fault;
  }
  return { exprs, diagnostics: [] };
}

/** Writes `text` as a Jumper string literal. `read` gives back the same text. */
export function quote(text: string): string {
  return `"${text.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("\n", "\\n")}"`;
}
