import { z } from "zod";
import { MAX_SOURCE } from "./state.ts";

const STORAGE_KEY = "jumper.playground.boards.v1";

/** A limit keeps a runaway import from filling the browser's storage. */
export const MAX_BOARDS = 200;
const MAX_NAME = 120;

export const SavedBoard = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(MAX_NAME),
  source: z.string().max(MAX_SOURCE),
  updatedAt: z.number().int().nonnegative(),
});

export type SavedBoard = z.infer<typeof SavedBoard>;

/**
 * Saved boards are per browser and may be edited by hand, so each entry is parsed on its own.
 * A bad entry is dropped, and the good ones are kept.
 */
export function parseBoards(raw: string | null): SavedBoard[] {
  if (raw === null) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const boards: SavedBoard[] = [];
  const ids = new Set<string>();
  for (const entry of data) {
    const parsed = SavedBoard.safeParse(entry);
    if (!parsed.success || ids.has(parsed.data.id)) continue;
    ids.add(parsed.data.id);
    boards.push(parsed.data);
  }
  return boards.slice(0, MAX_BOARDS);
}

export function loadBoards(): SavedBoard[] {
  try {
    return parseBoards(localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

/** Returns false when the browser blocks storage or it is full, so the caller can tell the user. */
function storeBoards(boards: readonly SavedBoard[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(boards));
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads the latest list, applies `change` and stores the result. Reading first means a save in one tab
 * does not wipe out a board saved in another tab.
 */
export function updateBoards(change: (boards: SavedBoard[]) => SavedBoard[]): { boards: SavedBoard[]; stored: boolean } {
  const boards = change(loadBoards()).slice(0, MAX_BOARDS);
  return { boards, stored: storeBoards(boards) };
}

export function isBoardsKey(key: string | null): boolean {
  return key === STORAGE_KEY;
}

/** Trims a name and keeps it within the stored limit. An empty name gives null. */
export function cleanName(name: string): string | null {
  const trimmed = name.trim().replace(/\s+/g, " ").slice(0, MAX_NAME);
  return trimmed === "" ? null : trimmed;
}

/** Adds a number when the name is taken, such as "Checkout (2)", so the menu can tell boards apart. */
export function uniqueName({ name, boards }: { name: string; boards: readonly SavedBoard[] }): string {
  const taken = new Set(boards.map((board) => board.name));
  if (!taken.has(name)) return name;
  for (let count = 2; ; count += 1) {
    const candidate = `${name} (${count})`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** A file name for an exported board: lowercase words joined by hyphens. */
export function fileName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^\w-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "board"}.jumper`;
}

/** The board name for an imported file: its name without the extension. */
export function nameFromFile(file: string): string {
  return cleanName(file.replace(/\.(jumper|txt)$/i, "")) ?? "Imported board";
}
