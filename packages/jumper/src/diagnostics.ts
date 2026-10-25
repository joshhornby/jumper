export type Span = { start: number; end: number };

/**
 * An error stops the render. A gap is a hole in the shaping work: the board
 * still draws, and the gap is marked on it.
 */
export type Severity = "error" | "gap";

export type Diagnostic = { severity: Severity; message: string; span: Span };

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
