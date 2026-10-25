import type { Diagnostic } from "./diagnostics.ts";
import { type Comment, type Expr, quote, read } from "./reader.ts";

export type FormatResult = { ok: true; text: string } | { ok: false; diagnostics: Diagnostic[] };

const INDENT = "  ";

/**
 * Prints Jumper source in one canonical layout, so that the same board always reads and diffs the same.
 *
 * - A list that holds only atoms prints on one line.
 * - A list that holds a list prints its head and leading atoms on one line, then each other item on its own line.
 * - Top-level forms are separated by one blank line.
 * - Comments stay with the code that follows them. A comment at the end of a line stays at the end of that line.
 *
 * Only a syntax error stops the printer. A board with other errors still formats.
 */
export function formatSource(source: string): FormatResult {
  const { exprs, comments, diagnostics } = read(source);
  if (diagnostics.length > 0) return { ok: false, diagnostics };

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

  let next = 0;
  const hasCommentBefore = (offset: number): boolean => (comments[next]?.span.start ?? Number.POSITIVE_INFINITY) < offset;
  /** Takes the comments that start before `offset`, in source order. Each comment is taken once. */
  const takeBefore = (offset: number): Comment[] => {
    const taken: Comment[] = [];
    for (let comment = comments[next]; comment !== undefined && comment.span.start < offset; comment = comments[next]) {
      taken.push(comment);
      next += 1;
    }
    return taken;
  };

  /**
   * Adds comments to `lines`. A comment on the line where the previous item ended joins that line.
   * Returns true when at least one comment was added, because the last line then ends in a comment.
   */
  const emit = ({
    lines,
    taken,
    indent,
    lastEnd,
  }: {
    lines: string[];
    taken: Comment[];
    indent: string;
    lastEnd: number | null;
  }): boolean => {
    for (const comment of taken) {
      const previous = lines.length - 1;
      if (lastEnd !== null && previous >= 0 && lineOf(comment.span.start) === lineOf(lastEnd)) {
        lines[previous] = `${lines[previous]} ${comment.text}`;
      } else {
        lines.push(`${indent}${comment.text}`);
      }
    }
    return taken.length > 0;
  };

  const atom = (expr: Exclude<Expr, { kind: "list" }>): string => {
    switch (expr.kind) {
      case "symbol":
        return expr.name;
      case "keyword":
        return `:${expr.name}`;
      case "string":
        return quote(expr.value);
    }
  };

  /** Returns the lines of `expr`. The caller indents the first line. */
  const print = ({ expr, indent }: { expr: Expr; indent: string }): string[] => {
    if (expr.kind !== "list") return [atom(expr)];
    const atoms = expr.items.flatMap((item) => (item.kind === "list" ? [] : [atom(item)]));
    if (atoms.length === expr.items.length && !hasCommentBefore(expr.span.end)) return [`(${atoms.join(" ")})`];

    const inner = indent + INDENT;
    let index = 0;
    const header: string[] = [];
    for (
      let item = expr.items[0];
      item !== undefined && item.kind !== "list" && !hasCommentBefore(item.span.start);
      item = expr.items[index]
    ) {
      header.push(atom(item));
      index += 1;
    }
    const lines = [`(${header.join(" ")}`];
    let lastEnd = expr.items[index - 1]?.span.end ?? expr.span.start;
    for (const item of expr.items.slice(index)) {
      emit({ lines, taken: takeBefore(item.span.start), indent: inner, lastEnd });
      const [first = "", ...rest] = print({ expr: item, indent: inner });
      lines.push(`${inner}${first}`, ...rest);
      lastEnd = item.span.end;
    }
    // A comment runs to the end of its line, so the closing parenthesis goes on the next line.
    if (emit({ lines, taken: takeBefore(expr.span.end), indent: inner, lastEnd })) return [...lines, `${indent})`];
    lines[lines.length - 1] = `${lines[lines.length - 1] ?? ""})`;
    return lines;
  };

  const blocks: string[][] = [];
  let lastEnd: number | null = null;
  const attach = (taken: Comment[]): Comment[] => {
    const last = blocks[blocks.length - 1];
    if (last === undefined || lastEnd === null) return taken;
    const end = lastEnd;
    const trailing = taken.filter((comment) => lineOf(comment.span.start) === lineOf(end));
    emit({ lines: last, taken: trailing, indent: "", lastEnd: end });
    return taken.filter((comment) => !trailing.includes(comment));
  };
  for (const expr of exprs) {
    const lines: string[] = [];
    emit({ lines, taken: attach(takeBefore(expr.span.start)), indent: "", lastEnd: null });
    lines.push(...print({ expr, indent: "" }));
    blocks.push(lines);
    lastEnd = expr.span.end;
  }
  const closing = attach(takeBefore(Number.POSITIVE_INFINITY));
  if (closing.length > 0) blocks.push(closing.map((comment) => comment.text));
  return { ok: true, text: blocks.length === 0 ? "" : `${blocks.map((lines) => lines.join("\n")).join("\n\n")}\n` };
}
