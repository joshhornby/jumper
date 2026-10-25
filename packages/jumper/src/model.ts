import type { Span } from "./diagnostics.ts";

export type WireRef = {
  target: string;
  /** The `:target` keyword alone, so a fix can replace just the id. */
  targetSpan: Span;
  label: string | null;
  span: Span;
};

type Wired = { wire: WireRef | null; span: Span };

export type Column = { title: string; items: string[] };

export type Widget =
  | ({ type: "title" | "text" | "meta" | "image"; text: string } & Wired)
  | ({ type: "field" | "button" | "primary" | "link" | "check" | "slot"; text: string } & Wired)
  | ({ type: "post"; author: string | null; text: string } & Wired)
  | ({ type: "list"; items: string[] } & Wired)
  | ({ type: "columns"; columns: Column[] } & Wired)
  | ({ type: "divider" } & Wired)
  /** A branch out of a system place, such as "valid" or "declined". */
  | ({ type: "out"; text: string } & Wired)
  /** A branch out of a decision, labelled by its condition. */
  | ({ type: "to"; text: string } & Wired);

export type WidgetType = Widget["type"];

export type Note = { kind: "note" | "question"; text: string; span: Span };

/**
 * screen: a page or dialog the user sees.
 * slot: a dotted placeholder for UI that is not designed yet.
 * system: code the flow depends on but the user does not see.
 * decision: a branch point, drawn as a diamond.
 */
export type PlaceKind = "screen" | "slot" | "system" | "decision";

export type Place = {
  kind: PlaceKind;
  id: string;
  idSpan: Span;
  title: string;
  /** 0 means the place sits outside any region. */
  region: number;
  widgets: Widget[];
  notes: Note[];
  span: Span;
};

export type Region = {
  /** Regions are numbered from 1 in source order. 0 holds places outside regions. */
  number: number;
  title: string;
  question: string | null;
  placeIds: string[];
  span: Span;
};

/** A `:via` or `:touch` value. The span covers the string, so diagnostics can point at it. */
export type StepOption = { text: string; span: Span };

export type Step = {
  place: string;
  placeSpan: Span;
  caption: string;
  via: StepOption | null;
  touch: StepOption | null;
  span: Span;
};

export type Story = { title: string; steps: Step[]; span: Span };

export type Board = {
  title: string;
  regions: Region[];
  places: Place[];
  stories: Story[];
};

export type Wire = {
  from: string;
  widget: number;
  to: string;
  /** The text a reader sees on the wire's source end: the affordance or branch. */
  affordance: string;
  label: string | null;
  targetSpan: Span;
  span: Span;
};

export function wireText(widget: Widget): string {
  switch (widget.type) {
    case "list":
      return widget.items.join(", ");
    case "columns":
      return widget.columns.map((column) => column.title).join(", ");
    case "divider":
      return "";
    default:
      return widget.text;
  }
}

export function wiresOf(board: Board): Wire[] {
  const wires: Wire[] = [];
  for (const place of board.places) {
    place.widgets.forEach((widget, index) => {
      if (widget.wire === null) return;
      wires.push({
        from: place.id,
        widget: index,
        to: widget.wire.target,
        affordance: wireText(widget),
        label: widget.wire.label,
        targetSpan: widget.wire.targetSpan,
        span: widget.wire.span,
      });
    });
  }
  return wires;
}
