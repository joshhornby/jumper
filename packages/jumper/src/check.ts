import type { Incomplete } from "./compile.ts";
import { type Diagnostic, type DiagnosticInput, diagnostic, type Fix, type Span } from "./diagnostics.ts";
import { type Board, type Place, type Widget, type Wire, wiresOf, wireText } from "./model.ts";
import { quote } from "./reader.ts";
import { closest } from "./suggest.ts";

/**
 * explicit: the step named the affordance with :via.
 * inferred: no :via, but exactly one wire joins the two places.
 * missing: no wire supports the hop. The storyboard describes a move the board cannot make.
 */
export type Hop = { kind: "explicit" | "inferred"; from: string; to: string; wire: number } | { kind: "missing"; from: string; to: string };

export type StoryPath = {
  /** hops[i] joins step i to step i + 1, so a story with n steps has n - 1 hops. */
  hops: Hop[];
  /** For each step, the widget index to highlight on its place, or null. */
  highlights: (number | null)[];
};

/** Plain data in a fixed order, so the same source always gives the same JSON. */
export type Analysis = {
  wires: Wire[];
  /** Wires whose target place does not exist, as ascending indexes into `wires`. */
  danglingWires: number[];
  /** Ids of unreachable places, in source order. */
  unreachable: string[];
  stories: StoryPath[];
  diagnostics: Diagnostic[];
};

function same(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function idFix({ word, candidates, span }: { word: string; candidates: readonly string[]; span: Span }): Fix | null {
  const match = closest({ word, candidates });
  return match === null ? null : { message: `Did you mean :${match}?`, edit: { span, text: `:${match}` } };
}

function textFix({ word, candidates, span }: { word: string; candidates: readonly string[]; span: Span }): Fix | null {
  const match = closest({ word, candidates });
  return match === null ? null : { message: `Did you mean ${quote(match)}?`, edit: { span, text: quote(match) } };
}

function findWidget({ place, text }: { place: Place; text: string }): number {
  return place.widgets.findIndex((widget: Widget) => same(wireText(widget), text));
}

const COMPLETE: Incomplete = { places: new Set(), stories: new Set() };

/**
 * Checks the board's wires and stories. Pass `incomplete` from a compile that had errors, so that
 * gaps caused by the dropped content are not reported on top of the errors.
 */
export function analyse({ board, incomplete = COMPLETE }: { board: Board; incomplete?: Incomplete }): Analysis {
  const diagnostics: Diagnostic[] = [];
  const gap = (input: DiagnosticInput): void => {
    diagnostics.push(diagnostic(input));
  };

  const places = new Map(board.places.map((place) => [place.id, place]));
  const placeIds = board.places.map((place) => place.id);
  const wires = wiresOf(board);
  const wiresFrom = (id: string): Wire[] => wires.filter((wire) => wire.from === id);

  /** When exactly one wire joins the two places, its affordance is the :via the step most likely meant. */
  const viaFix = ({ from, to, span }: { from: string; to: string; span: Span }): Fix | null => {
    const joining = wiresFrom(from).filter((wire) => wire.to === to);
    const only = joining[0];
    if (joining.length !== 1 || only === undefined) return null;
    return { message: `Use the wire that leads to :${to}: ${quote(only.affordance)}`, edit: { span, text: quote(only.affordance) } };
  };
  const danglingWires: number[] = [];

  wires.forEach((wire, index) => {
    if (!places.has(wire.to)) {
      danglingWires.push(index);
      if (incomplete.places.has(wire.to)) return;
      gap({
        code: "unknown-target",
        message: `"${wire.affordance}" is wired to :${wire.to}, but no place has that id.`,
        span: wire.targetSpan,
        fix: idFix({ word: wire.to, candidates: placeIds, span: wire.targetSpan }),
      });
    }
  });

  for (const place of board.places) {
    const seen = new Map<string, Wire>();
    for (const wire of wiresFrom(place.id)) {
      const name = wire.affordance.trim().toLowerCase();
      const first = seen.get(name);
      if (first === undefined) {
        seen.set(name, wire);
      } else if (first.to !== wire.to && !incomplete.places.has(place.id)) {
        gap({
          code: "duplicate-affordance",
          message: `${place.title} has two wires named "${wire.affordance}" that lead to different places. Rename one, so that a story can say which it means.`,
          span: wire.span,
          related: [{ span: first.span, message: `The first "${first.affordance}" leads to :${first.to}.` }],
        });
      }
    }
  }

  const incoming = new Map<string, number>();
  for (const wire of wires) {
    if (wire.from !== wire.to) incoming.set(wire.to, (incoming.get(wire.to) ?? 0) + 1);
  }
  const entries = board.places.filter((place) => !incoming.has(place.id));
  const start = entries.length > 0 ? entries : board.places.slice(0, 1);
  const reached = new Set(start.map((place) => place.id));
  const queue = [...reached];
  while (queue.length > 0) {
    const current = queue.shift() ?? "";
    for (const wire of wires) {
      if (wire.from === current && places.has(wire.to) && !reached.has(wire.to)) {
        reached.add(wire.to);
        queue.push(wire.to);
      }
    }
  }
  const unreachable: string[] = [];
  for (const place of board.places) {
    if (reached.has(place.id)) continue;
    unreachable.push(place.id);
    // A dropped widget may have held the wire that reaches this place.
    if (incomplete.places.size > 0) continue;
    gap({ code: "unreachable", message: `${place.title} is unreachable. No entry point leads to it.`, span: place.idSpan });
  }

  const stories: StoryPath[] = board.stories.map((story, storyIndex) => {
    const hops: Hop[] = [];
    const highlights: (number | null)[] = [];
    const storyIncomplete = incomplete.stories.has(storyIndex);
    if (story.steps.length === 0 && !storyIncomplete)
      gap({ code: "empty-story", message: `The story "${story.title}" has no steps.`, span: story.span });

    story.steps.forEach((step, index) => {
      const after = story.steps[index + 1];
      const quiet = storyIncomplete || incomplete.places.has(step.place) || (after !== undefined && incomplete.places.has(after.place));
      const gap = (input: DiagnosticInput): void => {
        if (!quiet) diagnostics.push(diagnostic(input));
      };
      const place = places.get(step.place);
      if (place === undefined) {
        gap({
          code: "unknown-step-place",
          message: `Step ${index + 1} is on :${step.place}, but no place has that id.`,
          span: step.placeSpan,
          fix: idFix({ word: step.place, candidates: placeIds, span: step.placeSpan }),
        });
        highlights.push(null);
      } else if (step.touch !== null) {
        const touched = findWidget({ place, text: step.touch.text });
        if (touched === -1) {
          gap({
            code: "unknown-touch",
            message: `${place.title} has no widget "${step.touch.text}" to touch.`,
            span: step.touch.span,
            fix: textFix({ word: step.touch.text, candidates: place.widgets.map(wireText).filter(Boolean), span: step.touch.span }),
          });
        }
        highlights.push(touched === -1 ? null : touched);
      } else {
        highlights.push(null);
      }

      const next = story.steps[index + 1];
      if (next === undefined) {
        if (step.via !== null) {
          gap({
            code: "via-on-last-step",
            message: `The last step has :via "${step.via.text}", but no step comes after it.`,
            span: step.via.span,
            fix: { message: "Remove :via from the last step.", edit: { span: step.via.removal, text: "" } },
          });
        }
        return;
      }
      // A missing place already has its own gap, so the hop is marked without a second one.
      if (place === undefined) {
        hops.push({ kind: "missing", from: step.place, to: next.place });
        return;
      }

      if (step.via !== null) {
        const via = step.via.text;
        const viaSpan = step.via.span;
        const candidates = wires
          .map((wire, wireIndex) => ({ wire, wireIndex }))
          .filter(({ wire }) => wire.from === step.place && (same(wire.affordance, via) || (wire.label !== null && same(wire.label, via))));
        if (candidates.length === 0) {
          const names = wiresFrom(step.place).flatMap((wire) => (wire.label === null ? [wire.affordance] : [wire.affordance, wire.label]));
          gap({
            code: "unknown-via",
            message: `${place.title} has no wired affordance "${via}".`,
            span: viaSpan,
            fix: textFix({ word: via, candidates: names, span: viaSpan }) ?? viaFix({ from: step.place, to: next.place, span: viaSpan }),
          });
          hops.push({ kind: "missing", from: step.place, to: next.place });
          return;
        }
        if (!places.has(next.place)) {
          hops.push({ kind: "missing", from: step.place, to: next.place });
          return;
        }
        const match = candidates.find(({ wire }) => wire.to === next.place);
        if (match === undefined) {
          const first = candidates[0]?.wire;
          gap({
            code: "via-leads-elsewhere",
            message: `"${via}" leads to :${first?.to ?? ""}, but the next step is on :${next.place}.`,
            span: viaSpan,
            related: first === undefined ? [] : [{ span: first.span, message: `"${first.affordance}" is wired here.` }],
            fix: viaFix({ from: step.place, to: next.place, span: viaSpan }),
          });
          hops.push({ kind: "missing", from: step.place, to: next.place });
          return;
        }
        if (step.touch === null) highlights[index] = match.wire.widget;
        hops.push({ kind: "explicit", from: step.place, to: next.place, wire: match.wireIndex });
        return;
      }

      if (!places.has(next.place)) {
        hops.push({ kind: "missing", from: step.place, to: next.place });
        return;
      }

      const joining = wires
        .map((wire, wireIndex) => ({ wire, wireIndex }))
        .filter(({ wire }) => wire.from === step.place && wire.to === next.place);
      const only = joining[0];
      if (joining.length === 1 && only !== undefined) {
        if (step.touch === null) highlights[index] = only.wire.widget;
        hops.push({ kind: "inferred", from: step.place, to: next.place, wire: only.wireIndex });
        return;
      }
      if (joining.length === 0) {
        gap({
          code: "hop-without-wire",
          message: `No wire leads from :${step.place} to :${next.place}. Wire an affordance, or fix the story.`,
          span: step.span,
        });
      } else {
        const options = joining.map(({ wire }) => `"${wire.affordance}"`).join(", ");
        gap({
          code: "ambiguous-hop",
          message: `More than one wire leads from :${step.place} to :${next.place}. Add :via with one of ${options}.`,
          span: step.span,
        });
      }
      hops.push({ kind: "missing", from: step.place, to: next.place });
    });

    return { hops, highlights };
  });

  return { wires, danglingWires, unreachable, stories, diagnostics };
}
