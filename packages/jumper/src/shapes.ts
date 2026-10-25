import { type Place, unreachable, type Widget } from "./model.ts";
import { escapeXml, textWidth, truncate, wrap } from "./text.ts";
import { colour } from "./theme.ts";

export type Fidelity = "wireframe" | "breadboard";

/** A fixed exit point with the direction a wire leaves in. Only decisions use fixed exits. */
export type Exit = { x: number; y: number; dx: number; dy: number };

export type WidgetBox = { x: number; y: number; width: number; height: number; exit: Exit | null };

export type NoteLine = { kind: "note" | "question"; lines: string[]; y: number };

export type PlaceShape = {
  width: number;
  height: number;
  /** Where incoming wires land, relative to the place's top. */
  entryY: number;
  /** Indexed like `place.widgets`. Null when this fidelity does not draw the widget. */
  widgets: (WidgetBox | null)[];
  notes: NoteLine[];
  labelLines: string[];
};

const SCREEN_WIDTH = 220;
const PAD = 12;
const GAP = 8;
const LABEL_SIZE = 14;
const LABEL_LINE = 18;
const NOTE_SIZE = 12;
const NOTE_LINE = 15;

function measureNotes({ place, top, width, showNotes }: { place: Place; top: number; width: number; showNotes: boolean }): {
  notes: NoteLine[];
  bottom: number;
} {
  if (!showNotes || place.notes.length === 0) return { notes: [], bottom: top };
  let y = top + 10;
  const notes: NoteLine[] = [];
  for (const note of place.notes) {
    const prefix = note.kind === "question" ? "⚠ " : "";
    const lines = wrap({ text: prefix + note.text, width, size: NOTE_SIZE });
    notes.push({ kind: note.kind, lines, y });
    y += lines.length * NOTE_LINE + 6;
  }
  return { notes, bottom: y };
}

function wireframeWidgetHeight({ widget, inner }: { widget: Widget; inner: number }): number {
  switch (widget.type) {
    case "title":
      return wrap({ text: widget.text, width: inner, size: 15 }).length * 19;
    case "text":
      return wrap({ text: widget.text, width: inner, size: 13 }).length * 17;
    case "meta":
      return wrap({ text: widget.text, width: inner, size: 11 }).length * 14;
    case "field":
    case "button":
    case "primary":
      return 30;
    case "link":
    case "check":
      return 18;
    case "slot":
      return 34;
    case "image":
      return 72;
    case "divider":
      return 9;
    case "list":
      return widget.items.length * 24;
    case "post":
      return 20 + wrap({ text: widget.text, width: inner - 26, size: 12 }).length * 16;
    case "columns":
      return 20 + Math.max(1, ...widget.columns.map((column) => column.items.length)) * 26;
    case "out":
    case "to":
      return 22;
  }
}

/** In breadboard fidelity a screen shows only its affordances and plain text, as in Shape Up. */
export function breadboardText(widget: Widget): string | null {
  if (widget.wire !== null) {
    if (widget.type === "list") return widget.items.join(", ");
    if (widget.type === "columns") return widget.columns.map((column) => column.title).join(", ");
    if (widget.type === "divider") return "—";
  }
  switch (widget.type) {
    case "text":
    case "field":
    case "button":
    case "primary":
    case "link":
    case "check":
    case "slot":
    case "out":
    case "to":
      return widget.text;
    case "post":
      return widget.wire !== null ? widget.text : null;
    case "title":
    case "meta":
    case "image":
      return widget.wire !== null ? widget.text : null;
    case "list":
    case "columns":
    case "divider":
      return null;
    default:
      return unreachable(widget);
  }
}

function measureScreen({ place, fidelity, showNotes }: { place: Place; fidelity: Fidelity; showNotes: boolean }): PlaceShape {
  if (fidelity === "breadboard") {
    const texts = place.widgets.map(breadboardText);
    const widest = Math.max(
      textWidth({ text: place.title, size: 15 }),
      ...texts.map((text) => (text === null ? 0 : textWidth({ text, size: 13 }) + 16)),
    );
    const width = Math.min(SCREEN_WIDTH, Math.max(140, widest + 8));
    const labelLines = wrap({ text: place.title, width, size: 15 });
    let y = labelLines.length * 20 + 12;
    const widgets = texts.map((text) => {
      if (text === null) return null;
      const box = { x: 0, y, width, height: 20, exit: null };
      y += 22;
      return box;
    });
    const { notes, bottom } = measureNotes({ place, top: y, width, showNotes });
    return { width, height: bottom + 4, entryY: 10, widgets, notes, labelLines };
  }

  const width = SCREEN_WIDTH;
  const inner = width - PAD * 2;
  const labelLines = wrap({ text: place.title, width, size: LABEL_SIZE });
  const boxTop = labelLines.length * LABEL_LINE + 6;
  let y = boxTop + PAD;
  const widgets = place.widgets.map((widget) => {
    const height = wireframeWidgetHeight({ widget, inner });
    const box = { x: PAD, y, width: inner, height, exit: null };
    y += height + GAP;
    return box;
  });
  const boxBottom = Math.max(boxTop + 56, y - GAP + PAD);
  const { notes, bottom } = measureNotes({ place, top: boxBottom, width, showNotes });
  return { width, height: bottom, entryY: boxTop + 16, widgets, notes, labelLines };
}

function measureSystem({ place, showNotes }: { place: Place; showNotes: boolean }): PlaceShape {
  const widest = Math.max(
    textWidth({ text: place.title, size: 14 }) + 24,
    ...place.widgets.map((widget) => textWidth({ text: breadboardText(widget) ?? "", size: 13 }) + 40),
  );
  const width = Math.min(SCREEN_WIDTH, Math.max(150, widest));
  const labelLines = wrap({ text: place.title, width: width - 24, size: 14 });
  let y = 10 + labelLines.length * 18 + 8;
  const widgets = place.widgets.map((widget) => {
    const lines = wrap({ text: breadboardText(widget) ?? "", width: width - 40, size: 13 });
    const height = lines.length * 17 + 5;
    const box = { x: 12, y, width: width - 24, height, exit: null };
    y += height;
    return box;
  });
  const boxBottom = y + 8;
  const { notes, bottom } = measureNotes({ place, top: boxBottom, width, showNotes });
  return { width, height: bottom, entryY: 19, widgets, notes, labelLines };
}

function measureDecision({ place, showNotes }: { place: Place; showNotes: boolean }): PlaceShape {
  const labelLines = wrap({ text: place.title, width: 92, size: 12 });
  const width = 168;
  const diamond = Math.max(96, labelLines.length * 15 + 56);
  const middle = diamond / 2;
  const vertices: Exit[] = [
    { x: width, y: middle, dx: 1, dy: 0 },
    { x: width / 2, y: diamond, dx: 0, dy: 1 },
    { x: width / 2, y: 0, dx: 0, dy: -1 },
    { x: 0, y: middle, dx: -1, dy: 0 },
  ];
  const widgets = place.widgets.map((_, index) => {
    const exit = vertices[index % vertices.length] ?? vertices[0] ?? null;
    return { x: 0, y: 0, width, height: diamond, exit };
  });
  const { notes, bottom } = measureNotes({ place, top: diamond, width, showNotes });
  return { width, height: bottom, entryY: middle, widgets, notes, labelLines };
}

export function measurePlace({ place, fidelity, showNotes }: { place: Place; fidelity: Fidelity; showNotes: boolean }): PlaceShape {
  switch (place.kind) {
    case "screen":
    case "slot":
      return measureScreen({ place, fidelity, showNotes });
    case "system":
      return measureSystem({ place, showNotes });
    case "decision":
      return measureDecision({ place, showNotes });
  }
}

type TextOptions = {
  x: number;
  y: number;
  size: number;
  fill?: string;
  weight?: number;
  anchor?: "start" | "middle" | "end";
  italic?: boolean;
};

export function svgText(options: TextOptions & { text: string }): string {
  const attrs = [`x="${options.x}"`, `y="${options.y}"`, `font-size="${options.size}"`, `fill="${options.fill ?? colour.ink}"`];
  if (options.weight !== undefined) attrs.push(`font-weight="${options.weight}"`);
  if (options.anchor !== undefined) attrs.push(`text-anchor="${options.anchor}"`);
  if (options.italic === true) attrs.push(`font-style="italic"`);
  return `<text ${attrs.join(" ")}>${escapeXml(options.text)}</text>`;
}

function lines({
  texts,
  x,
  y,
  size,
  step,
  fill,
  weight,
  anchor,
}: { texts: string[]; x: number; y: number; size: number; step: number } & Omit<TextOptions, "x" | "y" | "size">): string {
  return texts
    .map((text, index) =>
      svgText({
        text: text,
        x,
        y: y + index * step,
        size,
        ...(fill === undefined ? {} : { fill }),
        ...(weight === undefined ? {} : { weight }),
        ...(anchor === undefined ? {} : { anchor }),
      }),
    )
    .join("");
}

function drawWireframeWidget({ widget, box }: { widget: Widget; box: WidgetBox }): string {
  const { x, y, width, height } = box;
  switch (widget.type) {
    case "title":
      return lines({ texts: wrap({ text: widget.text, width, size: 15 }), x, y: y + 14, size: 15, step: 19, weight: 700 });
    case "text":
      return lines({ texts: wrap({ text: widget.text, width, size: 13 }), x, y: y + 13, size: 13, step: 17, fill: "#495057" });
    case "meta":
      return lines({ texts: wrap({ text: widget.text, width, size: 11 }), x, y: y + 11, size: 11, step: 14, fill: colour.muted });
    case "field":
      return (
        `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="4" fill="${colour.paper}" stroke="${colour.faint}"/>` +
        svgText({ text: truncate({ text: widget.text, width: width - 16, size: 12 }), x: x + 8, y: y + 19, size: 12, fill: colour.muted })
      );
    case "button":
    case "primary": {
      const label = truncate({ text: widget.text, width: width - 24, size: 13 });
      const buttonWidth = Math.min(width, textWidth({ text: label, size: 13 }) + 28);
      const fill = widget.type === "primary" ? colour.primary : colour.paper;
      const stroke = widget.type === "primary" ? colour.primary : colour.ink;
      const ink = widget.type === "primary" ? colour.paper : colour.ink;
      return (
        `<rect x="${x}" y="${y}" width="${buttonWidth}" height="${height}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>` +
        svgText({ text: label, x: x + buttonWidth / 2, y: y + 19, size: 13, fill: ink, weight: 600, anchor: "middle" })
      );
    }
    case "link": {
      const label = truncate({ text: widget.text, width, size: 13 });
      const underline = Math.min(width, textWidth({ text: label, size: 13 }));
      return (
        svgText({ text: label, x, y: y + 13, size: 13, fill: colour.link }) +
        `<line x1="${x}" y1="${y + 16}" x2="${x + underline}" y2="${y + 16}" stroke="${colour.link}"/>`
      );
    }
    case "check":
      return (
        `<rect x="${x}" y="${y + 3}" width="12" height="12" rx="2" fill="${colour.paper}" stroke="${colour.ink}"/>` +
        svgText({ text: truncate({ text: widget.text, width: width - 20, size: 13 }), x: x + 20, y: y + 14, size: 13 })
      );
    case "slot":
      return (
        `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="4" fill="none" stroke="${colour.muted}" stroke-dasharray="3 3"/>` +
        svgText({
          text: truncate({ text: widget.text, width: width - 16, size: 12 }),
          x: x + width / 2,
          y: y + 21,
          size: 12,
          fill: colour.muted,
          anchor: "middle",
        })
      );
    case "image":
      return (
        `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${colour.panel}" stroke="${colour.line}"/>` +
        `<path d="M${x} ${y}L${x + width} ${y + height}M${x + width} ${y}L${x} ${y + height}" stroke="${colour.line}"/>` +
        svgText({
          text: truncate({ text: widget.text, width: width - 16, size: 11 }),
          x: x + width / 2,
          y: y + height / 2 + 4,
          size: 11,
          fill: colour.muted,
          anchor: "middle",
        })
      );
    case "divider":
      return `<line x1="${x}" y1="${y + 4}" x2="${x + width}" y2="${y + 4}" stroke="${colour.line}"/>`;
    case "list":
      return widget.items
        .map((item, index) => {
          const rowY = y + index * 24;
          return (
            svgText({ text: truncate({ text: item, width, size: 13 }), x, y: rowY + 16, size: 13 }) +
            `<line x1="${x}" y1="${rowY + 23}" x2="${x + width}" y2="${rowY + 23}" stroke="${colour.panel}"/>`
          );
        })
        .join("");
    case "post": {
      const author = widget.author ?? "Someone";
      return (
        `<circle cx="${x + 9}" cy="${y + 9}" r="9" fill="${colour.panel}" stroke="${colour.line}"/>` +
        svgText({ text: truncate({ text: author, width: width - 26, size: 12 }), x: x + 26, y: y + 13, size: 12, weight: 700 }) +
        lines({
          texts: wrap({ text: widget.text, width: width - 26, size: 12 }),
          x: x + 26,
          y: y + 30,
          size: 12,
          step: 16,
          fill: "#495057",
        })
      );
    }
    case "columns": {
      const count = Math.max(1, widget.columns.length);
      const columnWidth = (width - (count - 1) * 6) / count;
      return widget.columns
        .map((column, index) => {
          const columnX = x + index * (columnWidth + 6);
          const cards = column.items
            .map(
              (item, cardIndex) =>
                `<rect x="${columnX}" y="${y + 20 + cardIndex * 26}" width="${columnWidth}" height="22" rx="3" fill="${colour.paper}" stroke="${colour.line}"/>` +
                svgText({
                  text: truncate({ text: item, width: columnWidth - 10, size: 10 }),
                  x: columnX + 5,
                  y: y + 35 + cardIndex * 26,
                  size: 10,
                }),
            )
            .join("");
          return (
            `<rect x="${columnX}" y="${y}" width="${columnWidth}" height="${height}" rx="4" fill="${colour.panel}"/>` +
            svgText({
              text: truncate({ text: column.title.toUpperCase(), width: columnWidth - 8, size: 9 }),
              x: columnX + 5,
              y: y + 13,
              size: 9,
              weight: 700,
              fill: colour.muted,
            }) +
            cards
          );
        })
        .join("");
    }
    case "out":
    case "to":
      return svgText({ text: widget.text, x, y: y + 15, size: 13 });
  }
}

export type DrawPlaceOptions = {
  place: Place;
  shape: PlaceShape;
  x: number;
  y: number;
  fidelity: Fidelity;
  highlights: ReadonlySet<number>;
  unreachable: boolean;
};

function drawHighlight(box: WidgetBox): string {
  return `<rect x="${box.x - 4}" y="${box.y - 3}" width="${box.width + 8}" height="${box.height + 6}" rx="6" fill="none" stroke="${colour.story}" stroke-width="2.5"/>`;
}

function drawNotes({ shape }: { shape: PlaceShape }): string {
  return shape.notes
    .map((note) =>
      lines({
        texts: note.lines,
        x: 0,
        y: note.y + 11,
        size: NOTE_SIZE,
        step: NOTE_LINE,
        fill: note.kind === "question" ? colour.gap : colour.muted,
        ...(note.kind === "question" ? { weight: 600 } : {}),
      }),
    )
    .join("");
}

export function drawPlace(options: DrawPlaceOptions): string {
  const { place, shape, x, y, fidelity, highlights, unreachable } = options;
  const parts: string[] = [];
  const bodyHeight = (shape.notes[0]?.y ?? shape.height + 10) - 10;

  if (unreachable) {
    parts.push(
      `<rect x="-8" y="-8" width="${shape.width + 16}" height="${bodyHeight + 16}" rx="10" fill="none" stroke="${colour.gap}" stroke-dasharray="5 4"/>`,
      svgText({ text: "unreachable", x: 0, y: -14, size: 11, fill: colour.gap, weight: 600 }),
    );
  }

  if (place.kind === "decision") {
    const { width } = shape;
    const height = shape.widgets[0]?.height ?? Math.max(96, shape.labelLines.length * 15 + 56);
    parts.push(
      `<path d="M${width / 2} 0L${width} ${height / 2}L${width / 2} ${height}L0 ${height / 2}Z" fill="${colour.decisionFill}" stroke="${colour.primary}" stroke-width="1.5"/>`,
      lines({
        texts: shape.labelLines,
        x: width / 2,
        y: height / 2 - ((shape.labelLines.length - 1) * 15) / 2 + 4,
        size: 12,
        step: 15,
        weight: 600,
        anchor: "middle",
      }),
    );
  } else if (place.kind === "system") {
    const firstNote = shape.notes[0];
    const boxHeight = firstNote === undefined ? shape.height : firstNote.y - 10;
    parts.push(
      `<rect x="0" y="0" width="${shape.width}" height="${boxHeight}" rx="8" fill="${colour.paper}" stroke="${colour.muted}" stroke-dasharray="6 4" stroke-width="1.5"/>`,
      lines({ texts: shape.labelLines, x: 12, y: 24, size: 14, step: 18, weight: 700 }),
    );
    place.widgets.forEach((widget, index) => {
      const box = shape.widgets[index];
      if (box === null || box === undefined) return;
      const text = wrap({ text: breadboardText(widget) ?? "", width: box.width - 16, size: 13 });
      parts.push(
        svgText({ text: "→", x: box.x, y: box.y + 14, size: 13, fill: colour.muted }),
        lines({ texts: text, x: box.x + 16, y: box.y + 14, size: 13, step: 17 }),
      );
    });
  } else if (fidelity === "breadboard") {
    const underline = shape.labelLines.length * 20 + 2;
    parts.push(
      lines({ texts: shape.labelLines, x: 0, y: 16, size: 15, step: 20, weight: 700 }),
      `<line x1="0" y1="${underline}" x2="${shape.width}" y2="${underline}" stroke="${colour.ink}" stroke-width="2"${place.kind === "slot" ? ' stroke-dasharray="4 3"' : ""}/>`,
    );
    place.widgets.forEach((widget, index) => {
      const box = shape.widgets[index];
      const text = breadboardText(widget);
      if (box === null || box === undefined || text === null) return;
      const label = truncate({ text, width: box.width - 8, size: 13 });
      if (widget.type === "field") {
        parts.push(
          `<rect x="${box.x}" y="${box.y}" width="${Math.min(box.width, textWidth({ text: label, size: 13 }) + 16)}" height="${box.height}" rx="3" fill="none" stroke="${colour.faint}"/>`,
          svgText({ text: label, x: box.x + 8, y: box.y + 14, size: 13 }),
        );
      } else if (widget.type === "text") {
        parts.push(svgText({ text: label, x: box.x, y: box.y + 14, size: 13, fill: colour.muted, italic: true }));
      } else if (widget.type === "slot") {
        parts.push(
          `<rect x="${box.x}" y="${box.y}" width="${Math.min(box.width, textWidth({ text: label, size: 13 }) + 16)}" height="${box.height}" rx="3" fill="none" stroke="${colour.muted}" stroke-dasharray="3 3"/>`,
          svgText({ text: label, x: box.x + 8, y: box.y + 14, size: 13, fill: colour.muted }),
        );
      } else {
        parts.push(svgText({ text: label, x: box.x, y: box.y + 14, size: 13 }));
      }
    });
  } else {
    const boxTop = shape.labelLines.length * LABEL_LINE + 6;
    const firstNote = shape.notes[0];
    const boxBottom = firstNote === undefined ? shape.height : firstNote.y - 10;
    const dotted = place.kind === "slot" ? ' stroke-dasharray="5 4"' : "";
    parts.push(
      lines({ texts: shape.labelLines, x: 0, y: 14, size: LABEL_SIZE, step: LABEL_LINE, weight: 700 }),
      `<rect x="0" y="${boxTop}" width="${shape.width}" height="${boxBottom - boxTop}" rx="10" fill="${colour.paper}" stroke="${place.kind === "slot" ? colour.muted : colour.ink}" stroke-width="1.5"${dotted}/>`,
    );
    place.widgets.forEach((widget, index) => {
      const box = shape.widgets[index];
      if (box !== null && box !== undefined) parts.push(drawWireframeWidget({ widget, box }));
    });
  }

  for (const index of highlights) {
    const box = shape.widgets[index];
    if (box !== null && box !== undefined && place.kind !== "decision") parts.push(drawHighlight(box));
  }

  parts.push(drawNotes({ shape }));
  return `<g transform="translate(${x} ${y})" data-place="${escapeXml(place.id)}">${parts.join("")}</g>`;
}
