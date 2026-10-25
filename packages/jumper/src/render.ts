import type { Analysis, Hop } from "./check.ts";
import { type BoardLayout, layoutBoard, type Positioned } from "./layout.ts";
import type { Board, Wire } from "./model.ts";
import { drawPlace, type Exit, type Fidelity, measurePlace, svgText } from "./shapes.ts";
import { escapeXml, textWidth, wrap } from "./text.ts";
import { colour, FONT } from "./theme.ts";

export type RenderOptions = {
  board: Board;
  analysis: Analysis;
  fidelity: Fidelity;
  showNotes: boolean;
  /** Index into `board.stories`, or null to draw no story. */
  story: number | null;
};

export type Rendered = { svg: string; width: number; height: number };

type Point = { x: number; y: number };

type WireStyle = "plain" | "story" | "inferred" | "dim";

const MARGIN_X = 40;
const REGION_TEXT_X = 28;

const STROKE: Record<WireStyle, string> = {
  plain: colour.ink,
  story: colour.story,
  inferred: colour.story,
  dim: colour.faint,
};

function markers(): string {
  const marker = ({ id, fill }: { id: string; fill: string }): string =>
    `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${fill}"/></marker>`;
  return `<defs>${marker({ id: "arrow-ink", fill: colour.ink })}${marker({ id: "arrow-story", fill: colour.story })}${marker({ id: "arrow-gap", fill: colour.gap })}${marker({ id: "arrow-dim", fill: colour.faint })}</defs>`;
}

function markerFor(style: WireStyle): string {
  if (style === "dim") return "arrow-dim";
  return style === "plain" ? "arrow-ink" : "arrow-story";
}

function sourceExit({ from, to, wire }: { from: Positioned; to: Positioned | null; wire: Wire }): Exit {
  const box = from.shape.widgets[wire.widget] ?? null;
  if (box?.exit) return { ...box.exit, x: from.x + box.exit.x, y: from.y + box.exit.y };
  const y = from.y + (box === null ? from.shape.entryY : box.y + box.height / 2);
  const right = { x: from.x + from.shape.width, y, dx: 1, dy: 0 };
  if (to === null || to === from) return right;
  if (to.x + to.shape.width <= from.x) return { x: from.x, y, dx: -1, dy: 0 };
  return right;
}

function targetEntry({ start, to }: { start: Exit; to: Positioned }): Exit {
  const y = to.y + to.shape.entryY;
  const left = { x: to.x, y, dx: -1, dy: 0 };
  const right = { x: to.x + to.shape.width, y, dx: 1, dy: 0 };
  if (start.dx === -1) return right;
  if (start.dx === 1) return to.x >= start.x - 1 ? left : right;
  return to.x + to.shape.width / 2 >= start.x ? left : right;
}

function curve({ start, end }: { start: Exit; end: Exit }): { d: string; middle: Point } {
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  const pull = start.dx === end.dx && start.dy === end.dy ? 70 : Math.min(140, Math.max(40, distance * 0.45));
  const c1 = { x: start.x + start.dx * pull, y: start.y + start.dy * pull };
  const c2 = { x: end.x + end.dx * pull, y: end.y + end.dy * pull };
  return {
    d: `M${start.x} ${start.y}C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${end.x} ${end.y}`,
    middle: {
      x: (start.x + 3 * c1.x + 3 * c2.x + end.x) / 8,
      y: (start.y + 3 * c1.y + 3 * c2.y + end.y) / 8,
    },
  };
}

function haloText({ text, at, fill }: { text: string; at: Point; fill: string }): string {
  return `<text x="${at.x}" y="${at.y + 4}" font-size="12" text-anchor="middle" fill="${fill}" paint-order="stroke" stroke="${colour.paper}" stroke-width="5" stroke-linejoin="round">${escapeXml(text)}</text>`;
}

function wireLabel({ wire, board }: { wire: Wire; board: Board }): string | null {
  const place = board.places.find((candidate) => candidate.id === wire.from);
  return place?.kind === "decision" ? wire.affordance : wire.label;
}

function drawWires({
  board,
  analysis,
  layout,
  styles,
}: {
  board: Board;
  analysis: Analysis;
  layout: BoardLayout;
  styles: WireStyle[];
}): string {
  const parts: string[] = [];
  const labels: string[] = [];
  analysis.wires.forEach((wire, index) => {
    const from = layout.places.get(wire.from);
    if (from === undefined) return;
    const style = styles[index] ?? "plain";
    const to = layout.places.get(wire.to) ?? null;

    if (to === null) {
      const start = sourceExit({ from, to: null, wire });
      const end = { x: start.x + 44, y: start.y };
      parts.push(
        `<path d="M${start.x} ${start.y}L${end.x} ${end.y}" stroke="${colour.gap}" stroke-width="1.5" stroke-dasharray="4 3" fill="none"/>`,
        `<circle cx="${end.x + 9}" cy="${end.y}" r="9" fill="${colour.paper}" stroke="${colour.gap}" stroke-width="1.5"/>`,
        svgText({ text: "?", x: end.x + 9, y: end.y + 4, size: 12, fill: colour.gap, weight: 700, anchor: "middle" }),
        svgText({ text: `:${wire.to}`, x: end.x + 22, y: end.y + 4, size: 11, fill: colour.gap }),
      );
      return;
    }

    const start = sourceExit({ from, to, wire });
    const end = targetEntry({ start, to });
    const { d, middle } = curve({ start, end });
    const width = style === "story" || style === "inferred" ? 2.5 : 1.5;
    const dash = style === "inferred" ? ' stroke-dasharray="6 4"' : "";
    parts.push(
      `<path d="${d}" stroke="${STROKE[style]}" stroke-width="${width}"${dash} fill="none" marker-end="url(#${markerFor(style)})"/>`,
    );
    const label = wireLabel({ wire, board });
    if (label !== null && label !== "") {
      labels.push(haloText({ text: label, at: middle, fill: style === "dim" ? colour.faint : STROKE[style] }));
    }
  });
  return parts.join("") + labels.join("");
}

function drawMissingHops({ hops, layout }: { hops: Hop[]; layout: BoardLayout }): string {
  return hops
    .filter((hop) => hop.kind === "missing")
    .map((hop) => {
      const from = layout.places.get(hop.from);
      const to = layout.places.get(hop.to);
      if (from === undefined || to === undefined) return "";
      const start = { x: from.x + from.shape.width / 2, y: from.y + from.shape.entryY };
      const end = { x: to.x + to.shape.width / 2, y: to.y + to.shape.entryY };
      const middle = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
      return (
        `<path d="M${start.x} ${start.y}L${end.x} ${end.y}" stroke="${colour.gap}" stroke-width="2" stroke-dasharray="6 5" fill="none" marker-end="url(#arrow-gap)"/>` +
        haloText({ text: "no wire", at: middle, fill: colour.gap })
      );
    })
    .join("");
}

function badge({ number, at }: { number: number; at: Point }): string {
  return (
    `<circle cx="${at.x}" cy="${at.y}" r="11" fill="${colour.story}"/>` +
    svgText({ text: String(number), x: at.x, y: at.y + 4, size: 12, fill: colour.paper, weight: 700, anchor: "middle" })
  );
}

function drawRegions(layout: BoardLayout): string {
  return layout.regions
    .map(({ region, x, y, width, height, questionLines }) => {
      const question = questionLines
        .map((line, index) =>
          svgText({ text: line, x: x + REGION_TEXT_X, y: y + 58 + index * 17, size: 13, fill: colour.muted, italic: true }),
        )
        .join("");
      return (
        `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="14" fill="${colour.panel}"/>` +
        `<circle cx="${x + 28 + 13}" cy="${y + 30}" r="14" fill="${colour.region}"/>` +
        svgText({ text: String(region.number), x: x + 41, y: y + 35, size: 14, fill: colour.paper, weight: 700, anchor: "middle" }) +
        svgText({ text: region.title, x: x + 64, y: y + 36, size: 17, weight: 700 }) +
        question
      );
    })
    .join("");
}

function drawStoryboard({
  board,
  analysis,
  fidelity,
  story,
  top,
}: Pick<RenderOptions, "board" | "analysis" | "fidelity"> & { story: number; top: number }): {
  svg: string;
  width: number;
  height: number;
} {
  const chosen = board.stories[story];
  const path = analysis.stories[story];
  if (chosen === undefined || path === undefined) return { svg: "", width: 0, height: 0 };
  const places = new Map(board.places.map((place) => [place.id, place]));
  const cardGap = 96;
  const cards = chosen.steps.map((step, index) => {
    const place = places.get(step.place);
    const shape = place === undefined ? null : measurePlace({ place, fidelity, showNotes: false });
    const width = Math.max(180, shape?.width ?? 180);
    const caption = wrap({ text: step.caption, width: width - 30, size: 13 });
    return { step, index, place, shape, width, caption };
  });
  const captionHeight = Math.max(0, ...cards.map((card) => card.caption.length)) * 17 + 18;
  const placeTop = top + 52 + captionHeight;
  const parts: string[] = [
    `<line x1="${MARGIN_X}" y1="${top}" x2="${MARGIN_X + 120}" y2="${top}" stroke="${colour.story}" stroke-width="3"/>`,
    svgText({ text: `Storyboard: ${chosen.title}`, x: MARGIN_X, y: top + 30, size: 18, weight: 700 }),
  ];

  let x = MARGIN_X;
  let bottom = placeTop;
  cards.forEach((card, index) => {
    parts.push(badge({ number: index + 1, at: { x: x + 11, y: top + 63 } }));
    card.caption.forEach((line, lineIndex) => {
      parts.push(svgText({ text: line, x: x + 30, y: top + 67 + lineIndex * 17, size: 13 }));
    });
    if (card.place === undefined || card.shape === null) {
      parts.push(
        `<rect x="${x}" y="${placeTop}" width="${card.width}" height="80" rx="10" fill="none" stroke="${colour.gap}" stroke-dasharray="5 4"/>`,
        svgText({
          text: `missing :${card.step.place}`,
          x: x + card.width / 2,
          y: placeTop + 44,
          size: 12,
          fill: colour.gap,
          anchor: "middle",
        }),
      );
      bottom = Math.max(bottom, placeTop + 80);
    } else {
      const highlight = path.highlights[index];
      parts.push(
        drawPlace({
          place: card.place,
          shape: card.shape,
          x,
          y: placeTop,
          fidelity,
          highlights: new Set(highlight === null || highlight === undefined ? [] : [highlight]),
          unreachable: false,
        }),
      );
      bottom = Math.max(bottom, placeTop + card.shape.height);
    }

    const hop = path.hops[index];
    if (hop !== undefined) {
      const arrowY = placeTop + (card.shape?.entryY ?? 40);
      const startX = x + card.width + 12;
      const endX = x + card.width + cardGap - 12;
      const missing = hop.kind === "missing";
      const stroke = missing ? colour.gap : colour.story;
      const label = missing ? "no wire" : (analysis.wires[hop.wire]?.affordance ?? "");
      parts.push(
        `<path d="M${startX} ${arrowY}L${endX} ${arrowY}" stroke="${stroke}" stroke-width="2"${missing || hop.kind === "inferred" ? ' stroke-dasharray="6 4"' : ""} marker-end="url(#${missing ? "arrow-gap" : "arrow-story"})"/>`,
      );
      const labelLines = wrap({ text: label, width: cardGap - 8, size: 11 });
      labelLines.forEach((line, lineIndex) => {
        parts.push(
          svgText({
            text: line,
            x: (startX + endX) / 2,
            y: arrowY - 10 - (labelLines.length - 1 - lineIndex) * 13,
            size: 11,
            fill: stroke,
            anchor: "middle",
          }),
        );
      });
    }
    x += card.width + cardGap;
  });

  return { svg: parts.join(""), width: x - cardGap + MARGIN_X, height: bottom - top };
}

export function render(options: RenderOptions): Rendered {
  const { board, analysis, fidelity, showNotes, story } = options;
  const layout = layoutBoard({ board, fidelity, showNotes });
  const path = story === null ? undefined : analysis.stories[story];
  const chosen = story === null ? undefined : board.stories[story];

  const storyWires = new Map<number, Hop["kind"]>();
  const highlights = new Map<string, Set<number>>();
  const visited = new Set<string>();
  if (path !== undefined && chosen !== undefined) {
    for (const hop of path.hops) if (hop.kind !== "missing") storyWires.set(hop.wire, hop.kind);
    chosen.steps.forEach((step, index) => {
      visited.add(step.place);
      const widget = path.highlights[index];
      if (widget === null || widget === undefined) return;
      const set = highlights.get(step.place) ?? new Set<number>();
      set.add(widget);
      highlights.set(step.place, set);
    });
  }

  const styles: WireStyle[] = analysis.wires.map((_, index) => {
    const kind = storyWires.get(index);
    if (kind === "explicit") return "story";
    if (kind === "inferred") return "inferred";
    return path === undefined ? "plain" : "dim";
  });

  const unreachable = new Set(analysis.unreachable);
  const placeParts: string[] = [];
  for (const positioned of layout.places.values()) {
    const dimmed = path !== undefined && !visited.has(positioned.place.id);
    const drawn = drawPlace({
      place: positioned.place,
      shape: positioned.shape,
      x: positioned.x,
      y: positioned.y,
      fidelity,
      highlights: highlights.get(positioned.place.id) ?? new Set(),
      unreachable: unreachable.has(positioned.place.id),
    });
    placeParts.push(dimmed ? `<g opacity="0.35">${drawn}</g>` : drawn);
  }

  const badges: string[] = [];
  if (chosen !== undefined) {
    const counts = new Map<string, number>();
    chosen.steps.forEach((step, index) => {
      const positioned = layout.places.get(step.place);
      if (positioned === undefined) return;
      const offset = counts.get(step.place) ?? 0;
      counts.set(step.place, offset + 1);
      badges.push(badge({ number: index + 1, at: { x: positioned.x - 6 + offset * 26, y: positioned.y - 8 } }));
    });
  }

  const title =
    svgText({ text: board.title, x: MARGIN_X, y: 40 + 28, size: 24, weight: 800 }) +
    (fidelity === "breadboard"
      ? svgText({
          text: "breadboard",
          x: MARGIN_X + textWidth({ text: board.title, size: 24 }) + 16,
          y: 40 + 28,
          size: 13,
          fill: colour.muted,
        })
      : "");

  const storyboard =
    story === null ? { svg: "", width: 0, height: 0 } : drawStoryboard({ board, analysis, fidelity, story, top: layout.height + 8 });
  const width = Math.ceil(Math.max(layout.width, storyboard.width));
  const height = Math.ceil(layout.height + (storyboard.height > 0 ? storyboard.height + 48 : 0));

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${escapeXml(FONT)}">` +
    markers() +
    `<rect width="${width}" height="${height}" fill="${colour.paper}"/>` +
    title +
    drawRegions(layout) +
    drawWires({ board, analysis, layout, styles }) +
    (path === undefined ? "" : drawMissingHops({ hops: path.hops, layout })) +
    placeParts.join("") +
    badges.join("") +
    storyboard.svg +
    `</svg>`;

  return { svg, width, height };
}
