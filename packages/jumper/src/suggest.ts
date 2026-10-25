/** Optimal string alignment distance: Levenshtein plus swaps of two neighbouring characters. */
export function distance({ a, b }: { a: string; b: string }): number {
  const rows: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  const at = (i: number, j: number): number => rows[i]?.[j] ?? Number.POSITIVE_INFINITY;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) best = Math.min(best, at(i - 2, j - 2) + 1);
      const row = rows[i];
      if (row !== undefined) row[j] = best;
    }
  }
  return at(a.length, b.length);
}

/**
 * Returns the one candidate that `word` most likely misspells, or null.
 * A wrong suggestion costs more than none, so a tie between candidates gives null.
 */
export function closest({ word, candidates }: { word: string; candidates: readonly string[] }): string | null {
  const target = word.trim().toLowerCase();
  if (target === "") return null;
  let best: string | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  let tied = false;
  for (const candidate of new Set(candidates)) {
    const option = candidate.trim().toLowerCase();
    if (option === target) continue;
    const score = distance({ a: target, b: option });
    // An extended or shortened id, such as :confirmation for :confirm, is far by edits but close in intent.
    const prefix = Math.min(option.length, target.length) >= 4 && (option.startsWith(target) || target.startsWith(option));
    const limit = Math.max(1, Math.min(3, Math.floor(Math.max(option.length, target.length) / 3)));
    if (score > limit && !prefix) continue;
    const ranked = prefix ? Math.min(score, limit) : score;
    if (ranked < bestScore) {
      best = candidate;
      bestScore = ranked;
      tied = false;
    } else if (ranked === bestScore) {
      tied = true;
    }
  }
  return tied ? null : best;
}
