import type { Analysed } from "./check.ts";
import type { Story } from "./model.ts";

export type Retarget = { key: string; before: string; after: string };

export type BoardDiff = {
  places: { added: string[]; removed: string[]; changed: string[] };
  wires: { added: string[]; removed: string[]; retargeted: Retarget[] };
  stories: { added: string[]; removed: string[]; changed: string[] };
  /** Titles of stories in the new board that a person should read again: new, edited, or now on a different path. */
  affected: string[];
};

/** JSON without source positions or region numbers, so that moving code does not count as a change. */
function signature(value: unknown): string {
  return JSON.stringify(value, (key, field: unknown) =>
    key === "span" || key === "removal" || key === "region" || key.endsWith("Span") ? undefined : field,
  );
}

/** Story titles can repeat, so a repeat gets a suffix, in the same way as wire keys. */
function storyKeys(stories: readonly Story[]): string[] {
  const counts = new Map<string, number>();
  return stories.map((story) => {
    const count = (counts.get(story.title) ?? 0) + 1;
    counts.set(story.title, count);
    return count === 1 ? story.title : `${story.title} #${count}`;
  });
}

/** The wire each hop of each story takes, by key, or "missing". Two equal paths mean the story behaves the same. */
function paths({ board, analysis }: Analysed): Map<string, string> {
  const keys = storyKeys(board.stories);
  const result = new Map<string, string>();
  analysis.stories.forEach((path, index) => {
    const hops = path.hops.map((hop) => (hop.kind === "missing" ? "missing" : (analysis.wires[hop.wire]?.key ?? "missing")));
    result.set(keys[index] ?? "", JSON.stringify(hops));
  });
  return result;
}

function compare<T>({ before, after, same }: { before: Map<string, T>; after: Map<string, T>; same: (a: T, b: T) => boolean }) {
  const added = [...after.keys()].filter((key) => !before.has(key));
  const removed = [...before.keys()].filter((key) => !after.has(key));
  const changed = [...after.entries()].flatMap(([key, value]) => {
    const old = before.get(key);
    return old !== undefined && !same(old, value) ? [key] : [];
  });
  return { added, removed, changed };
}

/**
 * Compares two versions of a board by meaning, not by text. Places are matched by id, wires by key
 * and stories by title. The result lists what changed and which stories need to be read again.
 */
export function diff({ before, after }: { before: Analysed; after: Analysed }): BoardDiff {
  const placeMap = ({ board }: Analysed) => new Map(board.places.map((place) => [place.id, signature(place)]));
  const places = compare({ before: placeMap(before), after: placeMap(after), same: (a, b) => a === b });

  const wireMap = ({ analysis }: Analysed) => new Map(analysis.wires.map((wire) => [wire.key, wire]));
  const wireBefore = wireMap(before);
  const wireAfter = wireMap(after);
  const wires = compare({ before: wireBefore, after: wireAfter, same: (a, b) => a.to === b.to });
  const retargeted = wires.changed.map((key) => ({ key, before: wireBefore.get(key)?.to ?? "", after: wireAfter.get(key)?.to ?? "" }));

  const storyMap = ({ board }: Analysed) => {
    const keys = storyKeys(board.stories);
    return new Map(board.stories.map((story, index) => [keys[index] ?? story.title, signature(story.steps)]));
  };
  const stories = compare({ before: storyMap(before), after: storyMap(after), same: (a, b) => a === b });

  const pathBefore = paths(before);
  const changedPlaces = new Set([...places.changed, ...places.removed]);
  const afterKeys = storyKeys(after.board.stories);
  const affected = [...paths(after).entries()].flatMap(([key, path]) => {
    const story = after.board.stories[afterKeys.indexOf(key)];
    const touchesChange = story?.steps.some((step) => changedPlaces.has(step.place)) ?? false;
    const fresh = stories.added.includes(key) || stories.changed.includes(key);
    return fresh || touchesChange || pathBefore.get(key) !== path ? [key] : [];
  });

  return {
    places,
    wires: { added: wires.added, removed: wires.removed, retargeted },
    stories,
    affected,
  };
}

/** A short summary for a person, one line for each kind of change. */
export function describeDiff(change: BoardDiff): string {
  const lines: string[] = [];
  const add = (label: string, items: string[]): void => {
    if (items.length > 0) lines.push(`${label}: ${items.join(", ")}`);
  };
  add(
    "Places added",
    change.places.added.map((id) => `:${id}`),
  );
  add(
    "Places removed",
    change.places.removed.map((id) => `:${id}`),
  );
  add(
    "Places changed",
    change.places.changed.map((id) => `:${id}`),
  );
  add("Wires added", change.wires.added);
  add("Wires removed", change.wires.removed);
  add(
    "Wires retargeted",
    change.wires.retargeted.map((item) => `${item.key} now leads to :${item.after}, not :${item.before}`),
  );
  add(
    "Stories added",
    change.stories.added.map((title) => `"${title}"`),
  );
  add(
    "Stories removed",
    change.stories.removed.map((title) => `"${title}"`),
  );
  add(
    "Stories changed",
    change.stories.changed.map((title) => `"${title}"`),
  );
  add(
    "Stories to read again",
    change.affected.map((title) => `"${title}"`),
  );
  return lines.length === 0 ? "No change in behaviour." : lines.join("\n");
}
