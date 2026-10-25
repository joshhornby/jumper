import { type Analysis, analyse } from "./check.ts";
import { compile } from "./compile.ts";
import type { Diagnostic } from "./diagnostics.ts";
import type { Board } from "./model.ts";
import { read } from "./reader.ts";
import { render } from "./render.ts";
import type { Fidelity } from "./shapes.ts";

export type { Analysis, Hop, StoryPath } from "./check.ts";
export type { Diagnostic, DiagnosticCode, Edit, Fix, Position, Related, Severity, Span } from "./diagnostics.ts";
export { applyEdits, positionAt } from "./diagnostics.ts";
export { formatDiagnostic, summarise } from "./format.ts";
export type { Board, Place, PlaceKind, Region, Step, Story, Widget, Wire } from "./model.ts";
export type { Expr } from "./reader.ts";
export type { Rendered, RenderOptions } from "./render.ts";
export type { Fidelity } from "./shapes.ts";
export { analyse, compile, read, render };

export type BuildOptions = {
  source: string;
  fidelity?: Fidelity;
  showNotes?: boolean;
  story?: number | null;
};

export type BuildResult =
  | { ok: true; board: Board; analysis: Analysis; svg: string; width: number; height: number; diagnostics: Diagnostic[] }
  | { ok: false; diagnostics: Diagnostic[] };

/** Compiles, checks and renders Jumper source in one call. Gaps are reported but do not stop the render. */
export function build({ source, fidelity = "wireframe", showNotes = true, story = null }: BuildOptions): BuildResult {
  const compiled = compile(source);
  if (compiled.board === null) return { ok: false, diagnostics: compiled.diagnostics };
  const analysis = analyse(compiled.board);
  const chosen = story !== null && story >= 0 && story < compiled.board.stories.length ? story : null;
  const rendered = render({ board: compiled.board, analysis, fidelity, showNotes, story: chosen });
  return {
    ok: true,
    board: compiled.board,
    analysis,
    svg: rendered.svg,
    width: rendered.width,
    height: rendered.height,
    diagnostics: analysis.diagnostics,
  };
}
