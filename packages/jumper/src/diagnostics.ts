export type Span = { start: number; end: number };

/**
 * An error stops the render. A gap is a hole in the shaping work: the board
 * still draws, and the gap is marked on it.
 */
export type Severity = "error" | "gap";

/** Each code has one severity, so tools can match on the code and never on the message. */
const SEVERITY = {
  "unclosed-string": "error",
  "unclosed-list": "error",
  "unmatched-paren": "error",
  "expected-form": "error",
  "expected-string": "error",
  "not-a-string": "error",
  "arrow-needs-space": "error",
  "argument-count": "error",
  "expected-target": "error",
  "missing-target": "error",
  "missing-condition": "error",
  "bad-wire-label": "error",
  "unexpected-value": "error",
  "missing-widget-name": "error",
  "unknown-widget": "error",
  "widget-not-allowed": "error",
  "bad-columns": "error",
  "missing-id": "error",
  "duplicate-id": "error",
  "unknown-form": "error",
  "duplicate-board": "error",
  "missing-board": "error",
  "story-holds-steps": "error",
  "bad-step-option": "error",
  "missing-option-value": "error",
  "duplicate-option": "error",
  "unknown-target": "gap",
  unreachable: "gap",
  "unknown-step-place": "gap",
  "unknown-touch": "gap",
  "unknown-via": "gap",
  "via-leads-elsewhere": "gap",
  "hop-without-wire": "gap",
  "ambiguous-hop": "gap",
  "empty-story": "gap",
  "via-on-last-step": "gap",
} as const satisfies Record<string, Severity>;

export type DiagnosticCode = keyof typeof SEVERITY;

/** Replace the text in `span` with `text`. An empty span inserts. */
export type Edit = { span: Span; text: string };

/** A suggestion. It has an edit only when the change is safe to apply without a person checking it. */
export type Fix = { message: string; edit: Edit | null };

/** Another place in the source that explains the diagnostic, such as the first use of a duplicate id. */
export type Related = { span: Span; message: string };

export type Diagnostic = {
  code: DiagnosticCode;
  severity: Severity;
  message: string;
  span: Span;
  related: Related[];
  fix: Fix | null;
};

export type DiagnosticInput = { code: DiagnosticCode; message: string; span: Span; related?: Related[]; fix?: Fix | null };

export function diagnostic({ code, message, span, related = [], fix = null }: DiagnosticInput): Diagnostic {
  return { code, severity: SEVERITY[code], message, span, related, fix };
}

/** Applies edits that do not overlap. Later edits are applied first, so earlier spans stay valid. */
export function applyEdits({ source, edits }: { source: string; edits: readonly Edit[] }): string {
  const sorted = [...edits].sort((a, b) => b.span.start - a.span.start);
  let result = source;
  let limit = Number.POSITIVE_INFINITY;
  for (const edit of sorted) {
    if (edit.span.end > limit) continue;
    result = result.slice(0, edit.span.start) + edit.text + result.slice(edit.span.end);
    limit = edit.span.start;
  }
  return result;
}

export type Position = { line: number; column: number };

export function positionAt({ source, offset }: { source: string; offset: number }): Position {
  let line = 1;
  let lineStart = 0;
  for (let index = 0; index < offset && index < source.length; index += 1) {
    if (source[index] === "\n") {
      line += 1;
      lineStart = index + 1;
    }
  }
  return { line, column: offset - lineStart + 1 };
}
