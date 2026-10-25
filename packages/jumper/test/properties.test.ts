import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import { build } from "../src/index.ts";

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
});
