import type { Board, Place, Region } from "./model.ts";
import { wiresOf } from "./model.ts";
import { type Fidelity, measurePlace, type PlaceShape } from "./shapes.ts";
import { textWidth, wrap } from "./text.ts";

export type Positioned = { place: Place; shape: PlaceShape; x: number; y: number };

export type RegionBox = {
  region: Region;
  x: number;
  y: number;
  width: number;
  height: number;
  questionLines: string[];
};

export type BoardLayout = {
  width: number;
  height: number;
  places: Map<string, Positioned>;
  regions: RegionBox[];
};

const MARGIN = 40;
const TITLE_HEIGHT = 64;
const REGION_GAP = 56;
const REGION_PAD = 28;
const COLUMN_GAP = 96;
const ROW_GAP = 44;
const REGIONS_PER_ROW = 3;

/** Rank each place by its distance from the region's entry points, so flow reads left to right. */
function rankPlaces({ region, board }: { region: Region; board: Board }): Map<string, number> {
  const inRegion = new Set(region.placeIds);
  const edges = wiresOf(board).filter((wire) => inRegion.has(wire.from) && inRegion.has(wire.to) && wire.from !== wire.to);
  const hasIncoming = new Set(edges.map((wire) => wire.to));
  const entries = region.placeIds.filter((id) => !hasIncoming.has(id));
  const ranks = new Map<string, number>();
  const queue = (entries.length > 0 ? entries : region.placeIds.slice(0, 1)).map((id) => {
    ranks.set(id, 0);
    return id;
  });
  while (queue.length > 0) {
    const current = queue.shift() ?? "";
    const rank = ranks.get(current) ?? 0;
    for (const wire of edges) {
      if (wire.from === current && !ranks.has(wire.to)) {
        ranks.set(wire.to, rank + 1);
        queue.push(wire.to);
      }
    }
  }
  for (const id of region.placeIds) if (!ranks.has(id)) ranks.set(id, 0);
  return ranks;
}

type Measured = {
  region: Region;
  width: number;
  height: number;
  header: number;
  pad: number;
  questionLines: string[];
  local: { id: string; shape: PlaceShape; x: number; y: number }[];
};

function measureRegion({
  region,
  board,
  fidelity,
  showNotes,
}: {
  region: Region;
  board: Board;
  fidelity: Fidelity;
  showNotes: boolean;
}): Measured {
  const places = new Map(board.places.map((place) => [place.id, place]));
  const ranks = rankPlaces({ region, board });
  const columns: { id: string; shape: PlaceShape }[][] = [];
  for (const id of region.placeIds) {
    const place = places.get(id);
    if (place === undefined) continue;
    const rank = ranks.get(id) ?? 0;
    while (columns.length <= rank) columns.push([]);
    columns[rank]?.push({ id, shape: measurePlace({ place, fidelity, showNotes }) });
  }

  const chrome = region.number !== 0;
  const pad = chrome ? REGION_PAD : 0;
  const local: Measured["local"] = [];
  let x = 0;
  let innerHeight = 0;
  for (const column of columns) {
    let y = 0;
    const columnWidth = Math.max(...column.map((entry) => entry.shape.width));
    for (const entry of column) {
      local.push({ id: entry.id, shape: entry.shape, x, y });
      y += entry.shape.height + ROW_GAP;
    }
    innerHeight = Math.max(innerHeight, y - ROW_GAP);
    x += columnWidth + COLUMN_GAP;
  }
  const innerWidth = Math.max(0, x - COLUMN_GAP);
  const titleWidth = chrome ? textWidth({ text: region.title, size: 17 }) + 48 : 0;
  const width = Math.max(innerWidth + pad * 2, chrome ? Math.max(280, titleWidth + pad * 2) : 0);
  const questionLines = chrome && region.question !== null ? wrap({ text: region.question, width: width - pad * 2, size: 13 }) : [];
  const header = chrome ? 44 + questionLines.length * 17 + 18 : 0;
  return { region, width, height: header + innerHeight + pad * 2, header, pad, questionLines, local };
}

export function layoutBoard({ board, fidelity, showNotes }: { board: Board; fidelity: Fidelity; showNotes: boolean }): BoardLayout {
  const places = new Map(board.places.map((place) => [place.id, place]));
  const measured = board.regions.map((region) => measureRegion({ region, board, fidelity, showNotes }));

  const positioned = new Map<string, Positioned>();
  const regions: RegionBox[] = [];
  let y = MARGIN + TITLE_HEIGHT;
  let width = MARGIN * 2 + textWidth({ text: board.title, size: 24 });

  for (let start = 0; start < measured.length; start += REGIONS_PER_ROW) {
    const row = measured.slice(start, start + REGIONS_PER_ROW);
    let x = MARGIN;
    let rowHeight = 0;
    for (const entry of row) {
      if (entry.region.number !== 0) {
        regions.push({ region: entry.region, x, y, width: entry.width, height: entry.height, questionLines: entry.questionLines });
      }
      for (const item of entry.local) {
        const place = places.get(item.id);
        if (place === undefined) continue;
        positioned.set(item.id, {
          place,
          shape: item.shape,
          x: x + entry.pad + item.x,
          y: y + entry.pad + entry.header + item.y,
        });
      }
      x += entry.width + REGION_GAP;
      rowHeight = Math.max(rowHeight, entry.height);
    }
    width = Math.max(width, x - REGION_GAP + MARGIN);
    y += rowHeight + REGION_GAP;
  }

  return { width, height: y - REGION_GAP + MARGIN, places: positioned, regions };
}
