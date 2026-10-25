import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import { build, type Expr, formatSource, read } from "../src/index.ts";

const HEADS = [
  "board",
  "story",
  "step",
  "region",
  "screen",
  "place",
  "slot",
  "system",
  "decision",
  "button",
  "link",
  "field",
  "out",
  "to",
  "note",
  "list",
  "columns",
  "col",
  "constructor",
  "toString",
  "__proto__",
  "hasOwnProperty",
];

const id = fc.constantFrom(":a", ":b", ":c", ":", ":constructor");
const text = fc.constantFrom('"a"', '"b"', '"Go"', '""', '"x y"');
const arg = fc.oneof(id, text, fc.constantFrom("->", ":via", ":touch", "x", "->:a"));

/** A form with a known head and random arguments, nested up to three deep. */
const form = (depth: number): fc.Arbitrary<string> => {
  const children = depth === 0 ? fc.constant<string[]>([]) : fc.array(form(depth - 1), { maxLength: 3 });
  return fc
    .tuple(fc.constantFrom(...HEADS), fc.array(arg, { maxLength: 4 }), children)
    .map(([head, args, nested]) => `(${[head, ...args, ...nested].join(" ")})`);
};

/** A board-shaped form, so random heads reach the place and widget readers, not only the top level. */
const board = fc
  .array(fc.tuple(fc.constantFrom(...HEADS), id, text, fc.array(form(1), { maxLength: 3 })), { maxLength: 4 })
  .map(
    (places) => `(board "B" ${places.map(([head, key, title, widgets]) => `(${head} ${key} ${title} ${widgets.join(" ")})`).join(" ")})`,
  );

const expr = fc.oneof(board, form(3), arg);

const comment = fc.constantFrom("; a note", ";", ";; two", "; (not code)");

/**
 * Joins expressions with random spacing and comments, as a person might type them. Comments also go
 * before random parentheses, so some sit inside lists. The generators put no parentheses inside strings.
 */
const messy = fc
  .tuple(
    fc.array(fc.tuple(expr, fc.constantFrom(" ", "\n", "\n\n  ", "\t"), fc.option(comment)), { maxLength: 4 }),
    fc.array(fc.option(comment, { freq: 3 }), { maxLength: 40 }),
  )
  .map(([parts, inner]) => {
    let paren = 0;
    return parts
      .map(([code, space, note]) => `${code}${space}${note === null ? "" : `${note}\n`}`)
      .join("")
      .replace(/[()]/g, (char) => {
        const note = inner[paren % Math.max(1, inner.length)] ?? null;
        paren += 1;
        return note === null ? char : `${note}\n${char}`;
      });
  });

type Plain = string | Plain[];

/** The tree without spans, so two sources with different layout can be compared. */
function plain(item: Expr): Plain {
  switch (item.kind) {
    case "list":
      return item.items.map(plain);
    case "symbol":
      return `symbol ${item.name}`;
    case "keyword":
      return `keyword ${item.name}`;
    case "string":
      return `string ${item.value}`;
  }
}

describe("properties", () => {
  test("build never throws, whatever the source", () => {
    fc.assert(
      fc.property(fc.array(expr, { maxLength: 4 }), (exprs) => {
        build({ source: exprs.join("\n"), story: 0 });
      }),
      { numRuns: 2000 },
    );
  });

  test("build never throws on arbitrary text", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 200 }), (source) => {
        build({ source });
      }),
      { numRuns: 1000 },
    );
  });

  test("build is deterministic", () => {
    fc.assert(
      fc.property(fc.array(expr, { maxLength: 4 }), (exprs) => {
        const source = exprs.join("\n");
        expect(JSON.stringify(build({ source, story: 0 }))).toBe(JSON.stringify(build({ source, story: 0 })));
      }),
      { numRuns: 300 },
    );
  });

  test("formatting keeps the tree and the comments", () => {
    fc.assert(
      fc.property(messy, (source) => {
        const formatted = formatSource(source);
        if (!formatted.ok) return;
        const before = read(source);
        const after = read(formatted.text);
        expect(after.exprs.map(plain)).toEqual(before.exprs.map(plain));
        expect(after.comments.map((item) => item.text)).toEqual(before.comments.map((item) => item.text));
      }),
      { numRuns: 1000 },
    );
  });

  test("formatting twice gives the same text as formatting once", () => {
    fc.assert(
      fc.property(messy, (source) => {
        const once = formatSource(source);
        if (!once.ok) return;
        expect(formatSource(once.text)).toEqual(once);
      }),
      { numRuns: 1000 },
    );
  });
});
