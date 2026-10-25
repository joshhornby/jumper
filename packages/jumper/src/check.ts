import type { Diagnostic } from "./diagnostics.ts";
import { type Board, type Place, type Widget, type Wire, wiresOf, wireText } from "./model.ts";

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

export type Analysis = {
  wires: Wire[];
  /** Wires whose target place does not exist. Indexes into `wires`. */
  danglingWires: Set<number>;
  unreachable: Set<string>;
  stories: StoryPath[];
  diagnostics: Diagnostic[];
};

function same(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function findWidget({ place, text }: { place: Place; text: string }): number {
  return place.widgets.findIndex((widget: Widget) => same(wireText(widget), text));
}

export function analyse(board: Board): Analysis {
  const diagnostics: Diagnostic[] = [];
  const gap = ({ message, span }: { message: string; span: Diagnostic["span"] }): void => {
    diagnostics.push({ severity: "gap", message, span });
  };

  const places = new Map(board.places.map((place) => [place.id, place]));
  const wires = wiresOf(board);
  const danglingWires = new Set<number>();

  wires.forEach((wire, index) => {
    if (!places.has(wire.to)) {
      danglingWires.add(index);
      gap({ message: `"${wire.affordance}" is wired to :${wire.to}, but no place has that id.`, span: wire.span });
    }
  });

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
  const unreachable = new Set<string>();
  for (const place of board.places) {
    if (reached.has(place.id)) continue;
    unreachable.add(place.id);
    gap({ message: `${place.title} is unreachable. It sits in a loop that no entry point leads into.`, span: place.span });
  }

  const stories: StoryPath[] = board.stories.map((story) => {
    const hops: Hop[] = [];
    const highlights: (number | null)[] = [];

    story.steps.forEach((step, index) => {
      const place = places.get(step.place);
      if (place === undefined) {
        gap({ message: `Step ${index + 1} is on :${step.place}, but no place has that id.`, span: step.span });
        highlights.push(null);
      } else if (step.touch !== null) {
        const touched = findWidget({ place, text: step.touch });
        if (touched === -1) gap({ message: `${place.title} has no widget "${step.touch}" to touch.`, span: step.span });
        highlights.push(touched === -1 ? null : touched);
      } else {
        highlights.push(null);
      }

      const next = story.steps[index + 1];
      if (next === undefined) return;
      // A missing place already has its own gap, so the hop is marked without a second one.
      if (place === undefined) {
        hops.push({ kind: "missing", from: step.place, to: next.place });
        return;
      }

      if (step.via !== null) {
        const via = step.via;
        const candidates = wires
          .map((wire, wireIndex) => ({ wire, wireIndex }))
          .filter(({ wire }) => wire.from === step.place && (same(wire.affordance, via) || (wire.label !== null && same(wire.label, via))));
        if (candidates.length === 0) {
          gap({ message: `${place.title} has no wired affordance "${via}".`, span: step.span });
          hops.push({ kind: "missing", from: step.place, to: next.place });
          return;
        }
        if (!places.has(next.place)) {
          hops.push({ kind: "missing", from: step.place, to: next.place });
          return;
        }
        const match = candidates.find(({ wire }) => wire.to === next.place);
        if (match === undefined) {
          const actual = candidates[0]?.wire.to ?? "";
          gap({ message: `"${via}" leads to :${actual}, but the next step is on :${next.place}.`, span: step.span });
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
        gap({ message: `No wire leads from :${step.place} to :${next.place}. Wire an affordance, or fix the story.`, span: step.span });
      } else {
        const options = joining.map(({ wire }) => `"${wire.affordance}"`).join(", ");
        gap({
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
