import { applyEdits, type Diagnostic, positionAt, type Span } from "./diagnostics.ts";

const WIDTH = 80;

type Paint = { header: (text: string) => string; mark: (text: string) => string; dim: (text: string) => string };

const PLAIN: Paint = { header: (text) => text, mark: (text) => text, dim: (text) => text };

function ansi({ severity }: { severity: Diagnostic["severity"] }): Paint {
  const tone = severity === "error" ? "31" : "33";
  return {
    header: (text) => `\u001b[${tone}m${text}\u001b[0m`,
    mark: (text) => `\u001b[${tone};1m${text}\u001b[0m`,
    dim: (text) => `\u001b[2m${text}\u001b[0m`,
  };
}

function lineAt({ source, line }: { source: string; line: number }): string {
  return source.split("\n")[line - 1] ?? "";
}

/** Shows the first line of `span` with a gutter and carets under the span. */
function snippet({ source, span, paint }: { source: string; span: Span; paint: Paint }): string {
  const start = positionAt({ source, offset: span.start });
  const end = positionAt({ source, offset: span.end });
  const text = lineAt({ source, line: start.line });
  const last = end.line === start.line ? end.column : text.length + 1;
  const width = Math.max(1, last - start.column);
  const digits = String(source.split("\n").length).length;
  const gutter = `${String(start.line).padStart(digits)} | `;
  const carets = `${" ".repeat(gutter.length + start.column - 1)}${paint.mark("^".repeat(width))}`;
  return `${paint.dim(gutter)}${text}\n${carets}`;
}

/** Shows the line the fix changes, as it reads after the fix. Returns null when the fix spans lines. */
function fixedLine({ source, diagnostic }: { source: string; diagnostic: Diagnostic }): { line: number; text: string } | null {
  const edit = diagnostic.fix?.edit;
  if (edit === undefined || edit === null) return null;
  const start = positionAt({ source, offset: edit.span.start });
  const end = positionAt({ source, offset: edit.span.end });
  if (start.line !== end.line || edit.text.includes("\n")) return null;
  const after = applyEdits({ source, edits: [edit] });
  return { line: start.line, text: lineAt({ source: after, line: start.line }).trim() };
}

/**
 * Formats a diagnostic for a person to read: a header with the code and location, the message,
 * the source with the problem underlined, related source, and the fix.
 */
export function formatDiagnostic({
  source,
  file,
  diagnostic,
  colour = false,
}: {
  source: string;
  file: string;
  diagnostic: Diagnostic;
  colour?: boolean;
}): string {
  const paint = colour ? ansi({ severity: diagnostic.severity }) : PLAIN;
  const { line, column } = positionAt({ source, offset: diagnostic.span.start });
  const title = `-- ${diagnostic.code.replaceAll("-", " ").toUpperCase()} `;
  const where = ` ${file}:${line}:${column}`;
  const rule = "-".repeat(Math.max(3, WIDTH - title.length - where.length));
  const parts = [paint.header(`${title}${rule}${where}`), diagnostic.message];
  if (source.length > 0) parts.push(snippet({ source, span: diagnostic.span, paint }));
  for (const related of diagnostic.related) {
    parts.push(related.message, snippet({ source, span: related.span, paint }));
  }
  if (diagnostic.fix !== null) {
    parts.push(diagnostic.fix.message);
    const changed = fixedLine({ source, diagnostic });
    if (changed !== null) parts.push(`Try changing line ${changed.line} to:\n\n    ${changed.text}`);
  }
  return parts.join("\n\n");
}

export function summarise(diagnostics: readonly Diagnostic[]): string {
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
  const gaps = diagnostics.length - errors;
  if (diagnostics.length === 0) return "No errors and no gaps.";
  const count = (value: number, word: string): string => `${value} ${word}${value === 1 ? "" : "s"}`;
  return [errors > 0 ? count(errors, "error") : "", gaps > 0 ? count(gaps, "gap") : ""].filter(Boolean).join(" and ").concat(".");
}
