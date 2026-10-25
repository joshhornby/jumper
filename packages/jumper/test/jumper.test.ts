import { describe, expect, test } from "bun:test";
import { examples } from "../src/examples.ts";
import {
  analyse,
  applyEdits,
  type Board,
  build,
  compile,
  diff,
  formatDiagnostic,
  formatSource,
  positionAt,
  scenarios,
  summarise,
} from "../src/index.ts";

const classic = `
(board "Invoice autopay"
  (place :invoice "Invoice"
    (info "Amount due, due date")
    (button "Turn on Autopay" -> :setup))
  (place :setup "Setup Autopay"
    (field "CC fields")
    (button "Submit" -> :save-card))
  (system :save-card "Save card"
    (out "valid" -> :confirm)
    (out "declined" -> :setup))
  (place :confirm "Confirmation"
    (info "Autopay is on")))

(story "Client turns on autopay"
  (step :invoice "Opens overdue invoice" :via "Turn on Autopay")
  (step :setup "Enters card once" :touch "CC fields" :via "Submit")
  (step :save-card "Card verified" :via "valid")
  (step :confirm "Future invoices pay themselves"))
`;

function messages(source: string): string[] {
  const result = build({ source });
  return result.diagnostics.map((diagnostic) => `${diagnostic.severity}: ${diagnostic.message}`);
}

function boardOf(source: string): Board {
  const compiled = compile(source);
  if (!compiled.ok) throw new Error(compiled.diagnostics.map((diagnostic) => diagnostic.message).join("\n"));
  return compiled.board;
}

describe("syntax", () => {
  test("an unclosed list stops the render and points at the opening parenthesis", () => {
    const source = `(board "A"\n  (screen :a "A"`;
    const result = build({ source });
    expect(result.ok).toBe(false);
    const first = result.diagnostics[0];
    expect(first?.severity).toBe("error");
    expect(positionAt({ source, offset: first?.span.start ?? -1 })).toEqual({ line: 2, column: 3 });
  });

  test("an unclosed list is found by indentation, not reported at the outermost list", () => {
    const source = `(board "A"\n  (screen :a "A"\n    (text "x")\n  (screen :b "B"\n    (text "y")))\n\n(story "S"\n  (step :a "1"))`;
    const [first] = build({ source }).diagnostics;
    expect(first?.code).toBe("unclosed-list");
    expect(positionAt({ source, offset: first?.span.start ?? -1 })).toEqual({ line: 2, column: 3 });
    expect(first?.related[0]?.message).toBe("It most likely ends before line 4, which starts at the same depth.");
  });

  test("a list that looked unclosed but closed later is not blamed", () => {
    const source = `(board "A"\n(screen :a "A"))\n(story "S"\n  (step :a "1")`;
    const [first] = build({ source }).diagnostics;
    expect(positionAt({ source, offset: first?.span.start ?? -1 })).toEqual({ line: 3, column: 1 });
  });

  test("a stray closing parenthesis is an error", () => {
    expect(messages(`(board "A"))`)).toEqual(["error: This closing parenthesis has no matching opening parenthesis."]);
  });

  test("comments and escaped quotes are read", () => {
    const board = boardOf(`; a comment\n(board "Say \\"hi\\"" (screen :a "A" (text "x")))`);
    expect(board.title).toBe('Say "hi"');
  });
});

describe("forms", () => {
  test("the original Shape Up breadboard syntax still compiles", () => {
    const result = build({ source: classic });
    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
  });

  test("an unknown widget is an error", () => {
    expect(messages(`(board "A" (screen :a "A" (sparkle "x")))`)).toEqual(["error: Unknown widget (sparkle …)."]);
  });

  test("names that are object prototype keys are unknown forms, not crashes", () => {
    expect(messages(`(board "A" (constructor :a "A" (text "x")))`)).toEqual([
      "error: Unknown form (constructor …) in the board. Use region, screen, slot, system or decision.",
    ]);
    expect(messages(`(board "A" (screen :a "A" (toString "x")))`)).toEqual(["error: Unknown widget (toString …)."]);
  });

  test("a duplicate id is an error", () => {
    expect(messages(`(board "A" (screen :a "A") (screen :a "B"))`)).toEqual(["error: The id :a is used twice."]);
  });

  test("a decision holds only branches", () => {
    expect(messages(`(board "A" (decision :d "Ok?" (button "x")))`)).toEqual([
      'error: A decision holds only (to :id "condition") branches.',
    ]);
  });

  test("regions are numbered in source order and places outside regions get region 0", () => {
    const board = boardOf(`(board "A" (screen :loose "L") (region "One" (screen :a "A")) (region "Two" "Why?" (screen :b "B")))`);
    expect(board.regions.map((region) => [region.number, region.title, region.question])).toEqual([
      [0, "", null],
      [1, "One", null],
      [2, "Two", "Why?"],
    ]);
  });

  test("(to …) has one spelling, and the arrow spelling is fixed to it", () => {
    const source = `(board "A" (screen :a "A" (button "Go" -> :d)) (decision :d "Ok?" (to "yes" -> :a) (to :a "no")))`;
    const [first] = build({ source }).diagnostics;
    expect(first?.code).toBe("missing-target");
    expect(first?.fix?.edit?.text).toBe('(to :a "yes")');
  });

  test("(board …) inside a place is fixed to (columns …)", () => {
    const [first] = build({ source: `(board "A" (screen :a "A" (board (col "Open"))))` }).diagnostics;
    expect(first?.fix?.edit?.text).toBe("columns");
  });

  test("a comma is not whitespace", () => {
    expect(build({ source: `(board "A" (screen :a "A" (list "x", "y")))` }).diagnostics[0]?.code).toBe("not-a-string");
  });

  test("a wire can carry a label", () => {
    const board = boardOf(`(board "A" (screen :a "A" (slot "On" -> :b "on due date")) (system :b "B"))`);
    expect(board.places[0]?.widgets[0]?.wire).toMatchObject({ target: "b", label: "on due date" });
  });
});

describe("gaps", () => {
  test("a wire to a missing place is a gap and the board still draws", () => {
    const result = build({ source: `(board "A" (screen :a "A" (button "Go" -> :nowhere)))` });
    expect(result.ok).toBe(true);
    expect(result.diagnostics.map((diagnostic) => diagnostic.message)).toEqual(['"Go" is wired to :nowhere, but no place has that id.']);
  });

  test("a loop with no way in is unreachable", () => {
    const board = boardOf(`(board "A"
      (screen :start "Start")
      (screen :x "X" (link "y" -> :y))
      (screen :y "Y" (link "x" -> :x)))`);
    expect([...analyse({ board: board }).unreachable]).toEqual(["x", "y"]);
  });

  test("a place downstream of an orphan loop is unreachable, and the message does not say it is in the loop", () => {
    const source = `(board "A" (screen :s "S") (screen :x "X" (link "y" -> :y)) (screen :y "Y" (link "x" -> :x) (link "z" -> :z)) (screen :z "Z"))`;
    expect(messages(source)).toContain("gap: Z is unreachable. No entry point leads to it.");
  });

  test("every place with no incoming wire counts as an entry point", () => {
    const board = boardOf(`(board "A" (screen :a "A") (screen :b "B"))`);
    expect(analyse({ board: board }).unreachable.length).toBe(0);
  });
});

describe("places", () => {
  test("a system with no outcome is a gap", () => {
    const source = `(board "A" (screen :a "A" (button "Save" -> :s)) (system :s "Save" (text "Writes the record")))`;
    expect(build({ source }).diagnostics.map((diagnostic) => diagnostic.code)).toEqual(["system-without-outcome"]);
  });

  test("a decision needs at least two branches", () => {
    const one = `(board "A" (screen :a "A" (button "Go" -> :d)) (decision :d "Ok?" (to :a "yes")))`;
    expect(messages(one)).toEqual(["gap: Ok? has one branch. A decision needs at least two (to …) branches."]);
    const two = `(board "A" (screen :a "A" (button "Go" -> :d)) (decision :d "Ok?" (to :a "yes") (to :a "no")))`;
    expect(messages(two)).toEqual([]);
  });

  test("a screen with no way out is a legitimate end, not a gap", () => {
    expect(messages(`(board "A" (screen :a "A" (button "Pay" -> :done)) (screen :done "Done" (text "Thanks")))`)).toEqual([]);
  });
});

describe("stories", () => {
  test("a hop without :via is inferred when exactly one wire fits", () => {
    const board = boardOf(classic);
    const [path] = analyse({ board: board }).stories;
    expect(path?.hops.map((hop) => hop.kind)).toEqual(["explicit", "explicit", "explicit"]);

    const inferred = boardOf(classic.replace(':via "valid"', ""));
    expect(analyse({ board: inferred }).stories[0]?.hops[2]?.kind).toBe("inferred");
  });

  test("a hop with no wire behind it is a gap", () => {
    const source = `(board "A" (screen :a "A") (screen :b "B")) (story "S" (step :a "1") (step :b "2"))`;
    expect(messages(source)).toEqual(["gap: No wire leads from :a to :b. Wire an affordance, or fix the story."]);
  });

  test(":via that leads somewhere else is a gap", () => {
    const source = `(board "A" (screen :a "A" (button "Go" -> :b)) (screen :b "B") (screen :c "C"))
      (story "S" (step :a "1" :via "Go") (step :c "2"))`;
    expect(messages(source)).toContain('gap: "Go" leads to :b, but the next step is on :c.');
  });

  test("two wires between the same places need :via", () => {
    const source = `(board "A" (screen :a "A" (button "Yes" -> :b) (link "Also" -> :b)) (screen :b "B"))
      (story "S" (step :a "1") (step :b "2"))`;
    expect(messages(source)).toEqual(['gap: More than one wire leads from :a to :b. Add :via with one of "Yes", "Also".']);
  });

  test("there is one hop for each pair of steps, even when a step's place is missing", () => {
    const source = `(board "A" (screen :a "A" (button "Go" -> :c)) (screen :c "C" (button "On" -> :d)) (screen :d "D"))
      (story "S" (step :a "1") (step :ghost "2") (step :c "3") (step :d "4"))`;
    const result = build({ source });
    if (!result.ok) throw new Error("did not compile");
    const hops = result.analysis.stories[0]?.hops ?? [];
    expect(hops.map((hop) => [hop.kind, hop.from, hop.to])).toEqual([
      ["missing", "a", "ghost"],
      ["missing", "ghost", "c"],
      ["inferred", "c", "d"],
    ]);
    expect(result.diagnostics.map((diagnostic) => diagnostic.message)).toEqual(["Step 2 is on :ghost, but no place has that id."]);
  });

  test(":via is still checked when the next step's place is missing", () => {
    const source = `(board "A" (screen :a "A" (button "Go" -> :b)) (screen :b "B")) (story "S" (step :a "1" :via "Typo") (step :ghost "2"))`;
    expect(messages(source)).toEqual(['gap: A has no wired affordance "Typo".', "gap: Step 2 is on :ghost, but no place has that id."]);
  });

  test("a story with no steps is a gap", () => {
    expect(messages(`(board "A" (screen :a "A")) (story "Empty")`)).toEqual(['gap: The story "Empty" has no steps.']);
  });

  test(":via on the last step is a gap, because no hop follows it", () => {
    const source = `(board "A" (screen :a "A" (button "Go" -> :b)) (screen :b "B")) (story "S" (step :a "1" :via "Go") (step :b "2" :via "Nope"))`;
    expect(messages(source)).toEqual(['gap: The last step has :via "Nope", but no step comes after it.']);
  });

  test("a step that repeats :via is an error", () => {
    const source = `(board "A" (screen :a "A")) (story "S" (step :a "1" :via "x" :via "y"))`;
    expect(messages(source)).toEqual(["error: This step already has :via. A step takes it once."]);
  });

  test(":touch highlights the named widget, and :via highlights the affordance", () => {
    const board = boardOf(classic);
    expect(analyse({ board: board }).stories[0]?.highlights).toEqual([1, 0, 0, null]);
  });
});

describe("render", () => {
  test("every example renders an SVG with its board title", () => {
    for (const example of examples) {
      const result = build({ source: example.source });
      if (!result.ok) throw new Error(`${example.id} failed to compile`);
      expect(result.svg.startsWith("<svg")).toBe(true);
      expect(result.svg).toContain(result.board.title);
    }
  });

  test("only the broken examples report gaps", () => {
    const gaps = Object.fromEntries(examples.map((example) => [example.id, build({ source: example.source }).diagnostics.length]));
    expect(gaps).toEqual({ autopay: 0, "password-reset": 0, "volunteer-requests": 1, broken: 7 });
  });

  test("text is escaped", () => {
    const result = build({ source: `(board "<script>" (screen :a "A & B"))` });
    expect(result.ok && result.svg.includes("<script>")).toBe(false);
    expect(result.ok && result.svg.includes("A &amp; B")).toBe(true);
  });

  test("a chosen story adds a storyboard strip and step badges", () => {
    const plain = build({ source: classic });
    const story = build({ source: classic, story: 0 });
    if (!plain.ok || !story.ok) throw new Error("did not compile");
    expect(story.svg).toContain("Storyboard: Client turns on autopay");
    expect(story.height).toBeGreaterThan(plain.height);
  });

  test("breadboard fidelity drops wireframe-only widgets", () => {
    const source = `(board "A" (screen :a "A" (image "Hero photo") (button "Go")))`;
    const wireframe = build({ source });
    const breadboard = build({ source, fidelity: "breadboard" });
    expect(wireframe.ok && wireframe.svg.includes("Hero photo")).toBe(true);
    expect(breadboard.ok && breadboard.svg.includes("Hero photo")).toBe(false);
    expect(breadboard.ok && breadboard.svg.includes("Go")).toBe(true);
  });
});

describe("diagnostics", () => {
  /** Returns each diagnostic as its code and the exact source text its span covers. */
  function pointed(source: string): [string, string][] {
    return build({ source }).diagnostics.map((diagnostic) => [diagnostic.code, source.slice(diagnostic.span.start, diagnostic.span.end)]);
  }

  test("each code has a fixed severity", () => {
    expect(build({ source: "(" }).diagnostics[0]).toMatchObject({ code: "unclosed-list", severity: "error" });
    expect(build({ source: `(board "A" (screen :a "A" (button "Go" -> :b)))` }).diagnostics[0]).toMatchObject({
      code: "unknown-target",
      severity: "gap",
    });
  });

  test("story gaps point at the exact value, not the whole step", () => {
    const source = `(board "A" (screen :a "A" (field "Email") (button "Go" -> :b)) (screen :b "B"))
      (story "S" (step :a "1" :touch "Mail" :via "Og") (step :ghost "2" :via "Last"))`;
    expect(pointed(source)).toEqual([
      ["unknown-touch", '"Mail"'],
      ["unknown-via", '"Og"'],
      ["unknown-step-place", ":ghost"],
      ["via-on-last-step", '"Last"'],
    ]);
  });

  test("wire and place gaps point at the id", () => {
    const source = `(board "A" (screen :s "S") (screen :x "X" (link "y" -> :y)) (screen :y "Y" (link "x" -> :x) (link "z" -> :nowhere "label")))`;
    expect(pointed(source)).toEqual([
      ["unknown-target", ":nowhere"],
      ["unreachable", ":x"],
      ["unreachable", ":y"],
    ]);
  });

  test("a duplicate id points at the second id", () => {
    expect(pointed(`(board "A" (screen :a "A") (screen :a "B"))`)).toEqual([["duplicate-id", ":a"]]);
  });
});

describe("fixes", () => {
  /** Applies machine-applicable fixes until none are left. A fixed place id can reveal fixes for its :via and :touch. */
  function fixed(source: string): string {
    let current = source;
    for (let pass = 0; pass < 5; pass += 1) {
      const edits = build({ source: current }).diagnostics.flatMap((diagnostic) => (diagnostic.fix?.edit ? [diagnostic.fix.edit] : []));
      if (edits.length === 0) break;
      current = applyEdits({ source: current, edits });
    }
    return current;
  }

  test("a misspelt wire target suggests the place id, and the fix removes the gap", () => {
    const source = `(board "A" (screen :invoice "I" (button "Go" -> :confirmation)) (screen :confirm "C"))`;
    expect(build({ source }).diagnostics[0]?.fix?.message).toBe("Did you mean :confirm?");
    const after = fixed(source);
    expect(after).toContain("-> :confirm)");
    expect(build({ source: after }).diagnostics).toEqual([]);
  });

  test("a misspelt step place, :via and :touch are each fixed", () => {
    const source = `(board "A" (screen :setup "S" (field "Card number") (button "Submit" -> :done)) (screen :done "D"))
      (story "S" (step :stup "1" :touch "Card numbr" :via "Sumbit") (step :done "2"))`;
    const after = fixed(source);
    expect(after).toContain('(step :setup "1" :touch "Card number" :via "Submit")');
    expect(build({ source: after }).diagnostics).toEqual([]);
  });

  test(":via that names nothing close suggests the only wire to the next step", () => {
    const source = `(board "A" (screen :a "A" (button "Continue" -> :b)) (screen :b "B")) (story "S" (step :a "1" :via "Zzz") (step :b "2"))`;
    expect(fixed(source)).toContain(':via "Continue"');
  });

  test(":via that leads elsewhere points at its wire and suggests the right one", () => {
    const source = `(board "A" (screen :a "A" (button "Go" -> :b) (link "Help" -> :c)) (screen :b "B") (screen :c "C"))
      (story "S" (step :a "1" :via "Go") (step :c "2"))`;
    const [first] = build({ source }).diagnostics;
    expect(first?.related.map((related) => source.slice(related.span.start, related.span.end))).toEqual([":b"]);
    expect(fixed(source)).toContain(':via "Help"');
  });

  test(":via on the last step is removed cleanly", () => {
    const source = `(board "A" (screen :a "A")) (story "S" (step :a "1" :via "Nope"))`;
    expect(fixed(source)).toBe(`(board "A" (screen :a "A")) (story "S" (step :a "1"))`);
  });

  test("a misspelt form name suggests the right one", () => {
    expect(fixed(`(board "A" (screen :a "A" (buton "Go")))`)).toBe(`(board "A" (screen :a "A" (button "Go")))`);
    expect(fixed(`(board "A" (sceen :a "A"))`)).toBe(`(board "A" (screen :a "A"))`);
    expect(fixed(`(bord "A")`)).toBe(`(board "A")`);
    expect(build({ source: `(board "A" (screen :a "A")) (story "S" (step :a "1" :vai "x"))` }).diagnostics[0]?.fix?.edit?.text).toBe(
      ":via",
    );
  });

  test("-> written against the id suggests a space", () => {
    const source = `(board "A" (screen :a "A" (button "Go" ->:b)) (screen :b "B"))`;
    expect(build({ source }).diagnostics[0]?.code).toBe("arrow-needs-space");
    expect(build({ source: fixed(source) }).diagnostics).toEqual([]);
  });

  test("a duplicate id points back at its first use", () => {
    const source = `(board "A" (screen :a "A") (screen :a "B"))`;
    const [first] = build({ source }).diagnostics;
    expect(first?.related[0]?.span).toEqual({ start: 19, end: 21 });
    expect(first?.fix).toBeNull();
  });

  test(":via and :touch match exactly, and a slip in case is fixed", () => {
    const source = `(board "A" (screen :a "A" (field "Email") (button "Go On" -> :b)) (screen :b "B"))
      (story "S" (step :a "1" :touch "email" :via "go on") (step :b "2"))`;
    expect(build({ source }).diagnostics.map((diagnostic) => diagnostic.code)).toEqual(["unknown-touch", "unknown-via"]);
    expect(fixed(source)).toContain(':touch "Email" :via "Go On"');
  });

  test("no suggestion is made when two ids are equally close", () => {
    const source = `(board "A" (screen :a "A" (button "Go" -> :cat)) (screen :bat "B") (screen :hat "H"))`;
    expect(build({ source }).diagnostics[0]?.fix).toBeNull();
  });
});

describe("format", () => {
  test("a diagnostic reads like the Elm compiler: header, message, underline and fix", () => {
    const source = `(board "Invoice"
  (system :save "Save card"
    (out "valid" -> :confirmation))
  (screen :confirm "Confirmation"))`;
    const [first] = build({ source }).diagnostics;
    if (first === undefined) throw new Error("expected a diagnostic");
    expect(formatDiagnostic({ source, file: "invoice.jumper", diagnostic: first })).toBe(
      [
        `-- UNKNOWN TARGET ${"-".repeat(42)} invoice.jumper:3:21`,
        "",
        '"valid" is wired to :confirmation, but no place has that id.',
        "",
        '3 |     (out "valid" -> :confirmation))',
        "                        ^^^^^^^^^^^^^",
        "",
        "Did you mean :confirm?",
        "",
        "Try changing line 3 to:",
        "",
        '    (out "valid" -> :confirm))',
      ].join("\n"),
    );
  });

  test("related source is shown under the message", () => {
    const source = `(board "A" (screen :a "A")\n  (screen :a "B"))`;
    const [first] = build({ source }).diagnostics;
    if (first === undefined) throw new Error("expected a diagnostic");
    const text = formatDiagnostic({ source, file: "a.jumper", diagnostic: first });
    expect(text).toContain(':a is first used here.\n\n1 | (board "A" (screen :a "A")\n                       ^^');
  });

  test("a syntax error in an empty position still formats", () => {
    const diagnostic = build({ source: "" }).diagnostics[0];
    if (diagnostic === undefined) throw new Error("expected a diagnostic");
    expect(formatDiagnostic({ source: "", file: "empty.jumper", diagnostic })).toContain("MISSING BOARD");
  });

  test("the summary counts errors and gaps", () => {
    expect(summarise([])).toBe("No errors and no gaps.");
    expect(summarise(build({ source: `(board "A" (screen :a "A" (button "Go" -> :b) (link "X" -> :c)))` }).diagnostics)).toBe("2 gaps.");
  });
});

describe("recovery", () => {
  function codes(source: string): string[] {
    return build({ source }).diagnostics.map((diagnostic) => diagnostic.code);
  }

  test("an error does not hide gaps in the rest of the board", () => {
    const source = `(board "A" (screen :a "A" (sparkle "x")) (screen :b "B" (button "Go" -> :nowhere)))`;
    expect(codes(source)).toEqual(["unknown-widget", "unknown-target"]);
    expect(build({ source }).ok).toBe(false);
  });

  test("a story gap elsewhere is still reported", () => {
    const source = `(board "A" (screen :a "A" (sparkle "x")) (screen :b "B") (screen :c "C"))
      (story "S" (step :b "1") (step :c "2"))`;
    expect(codes(source)).toEqual(["unknown-widget", "hop-without-wire"]);
  });

  test("a dropped widget does not echo as a :via gap", () => {
    const source = `(board "A" (screen :a "A" (buton "Go" -> :b)) (screen :b "B")) (story "S" (step :a "1" :via "Go") (step :b "2"))`;
    expect(codes(source)).toEqual(["unknown-widget"]);
  });

  test("a dropped place does not echo as an unknown target or step place", () => {
    const source = `(board "A" (screen :a "A" (button "Go" -> :b)) (sceen :b "B")) (story "S" (step :a "1") (step :b "2"))`;
    expect(codes(source)).toEqual(["unknown-form"]);
  });

  test("a dropped step does not echo as a hop gap", () => {
    const source = `(board "A" (screen :a "A" (button "Go" -> :c)) (screen :b "B") (screen :c "C"))
      (story "S" (step :a "1") (step "no id") (step :c "2"))`;
    expect(codes(source)).toEqual(["missing-id"]);
  });

  test("a syntax error still stops everything, because the structure is unknown", () => {
    expect(codes(`(board "A" (screen :a "A" (button "Go" -> :nowhere))`)).toEqual(["unclosed-list"]);
  });
});

describe("stable output", () => {
  test("a build result survives a JSON round trip unchanged", () => {
    for (const example of examples) {
      const result = build({ source: example.source, story: 0 });
      if (!result.ok) throw new Error(`${example.id} failed`);
      expect(JSON.parse(JSON.stringify(result.analysis))).toEqual(result.analysis);
    }
  });

  test("wire keys name the place and affordance, and do not change when a widget is added", () => {
    const before = boardOf(`(board "A" (screen :a "A" (button "Go" -> :b) (button "Go" -> :b)) (screen :b "B"))`);
    const after = boardOf(
      `(board "A" (screen :a "A" (title "New") (link "Help" -> :b) (button "Go" -> :b) (button "Go" -> :b)) (screen :b "B"))`,
    );
    const keys = (board: Board): string[] => analyse({ board }).wires.map((wire) => wire.key);
    expect(keys(before)).toEqual([':a "Go"', ':a "Go" #2']);
    expect(keys(after)).toEqual([':a "Help"', ':a "Go"', ':a "Go" #2']);
  });

  test("two wires with one name that lead to different places are a gap", () => {
    const source = `(board "A" (screen :a "A" (button "Go" -> :b) (link "Go" -> :c)) (screen :b "B") (screen :c "C"))`;
    expect(build({ source }).diagnostics.map((diagnostic) => diagnostic.code)).toEqual(["duplicate-affordance"]);
    expect(messages(`(board "A" (screen :a "A" (button "Save" -> :b) (button "Save" -> :b)) (screen :b "B"))`)).toEqual([]);
  });
});

describe("fmt", () => {
  test("the examples are already in the canonical layout", () => {
    for (const example of examples) {
      expect(formatSource(example.source)).toEqual({ ok: true, text: example.source });
    }
  });

  test("a list that holds lists puts each child on its own line", () => {
    const result = formatSource(`(board "A" (region "R" (screen :a "A" (button "Go" -> :b) (text   "x"))))  (story "S" (step :a "1"))`);
    expect(result).toEqual({
      ok: true,
      text: `(board "A"\n  (region "R"\n    (screen :a "A"\n      (button "Go" -> :b)\n      (text "x"))))\n\n(story "S"\n  (step :a "1"))\n`,
    });
  });

  test("comments stay with their code", () => {
    const source = `; top\n(board "A" ; title\n  ; before\n  (screen :a "A") ; after\n  ; last\n)\n`;
    expect(formatSource(source)).toEqual({
      ok: true,
      text: `; top\n(board "A" ; title\n  ; before\n  (screen :a "A") ; after\n  ; last\n)\n`,
    });
  });

  test("a syntax error stops formatting", () => {
    expect(formatSource(`(board "A"`)).toMatchObject({ ok: false, diagnostics: [{ code: "unclosed-list" }] });
  });
});

describe("diff", () => {
  function analysed(source: string) {
    const result = build({ source });
    if (!result.ok) throw new Error("did not compile");
    return result;
  }

  const base = `(board "A"
  (screen :cart "Cart" (primary "Checkout" -> :pay))
  (screen :pay "Pay" (primary "Pay" -> :done))
  (screen :done "Done"))
(story "Buys" (step :cart "1") (step :pay "2") (step :done "3"))
(story "Looks" (step :cart "1"))`;

  test("moving code and changing layout is not a change in behaviour", () => {
    const moved = `(board "A"
  (region "Shop" (screen :pay "Pay" (primary "Pay" -> :done)) (screen :cart "Cart" (primary "Checkout" -> :pay)))
  (screen :done "Done"))
(story "Looks" (step :cart "1"))
(story "Buys" (step :cart "1") (step :pay "2") (step :done "3"))`;
    const change = diff({ before: analysed(base), after: analysed(moved) });
    expect(change).toEqual({
      places: { added: [], removed: [], changed: [] },
      wires: { added: [], removed: [], retargeted: [] },
      stories: { added: [], removed: [], changed: [] },
      affected: [],
    });
  });

  test("a retargeted wire lists the stories whose path it changes", () => {
    const after = base
      .replace(`(primary "Pay" -> :done)`, `(primary "Pay" -> :check)`)
      .replace(`(screen :done "Done"))`, `(system :check "Check card" (out "ok" -> :done)) (screen :done "Done"))`);
    const change = diff({ before: analysed(base), after: analysed(after) });
    expect(change.places).toEqual({ added: ["check"], removed: [], changed: ["pay"] });
    expect(change.wires).toEqual({
      added: [':check "ok"'],
      removed: [],
      retargeted: [{ key: ':pay "Pay"', before: "done", after: "check" }],
    });
    expect(change.affected).toEqual(["Buys"]);
  });

  test("an edited story is affected, and an untouched one is not", () => {
    const after = base.replace(`(step :cart "1"))`, `(step :cart "Browses"))`);
    const change = diff({ before: analysed(base), after: analysed(after) });
    expect(change.stories.changed).toEqual(["Looks"]);
    expect(change.affected).toEqual(["Looks"]);
  });
});

describe("scenarios", () => {
  test("a story becomes steps with an actor, an affordance and the place to expect", () => {
    const result = build({ source: classic });
    if (!result.ok) throw new Error("did not compile");
    const [scenario] = scenarios(result);
    expect(scenario).toEqual({
      story: "Client turns on autopay",
      runnable: true,
      steps: [
        {
          place: "invoice",
          kind: "screen",
          title: "Invoice",
          caption: "Opens overdue invoice",
          touch: null,
          action: { actor: "user", affordance: "Turn on Autopay", wire: ':invoice "Turn on Autopay"', inferred: false },
          expect: "setup",
        },
        {
          place: "setup",
          kind: "screen",
          title: "Setup Autopay",
          caption: "Enters card once",
          touch: { text: "CC fields", widget: "field", interactive: true },
          action: { actor: "user", affordance: "Submit", wire: ':setup "Submit"', inferred: false },
          expect: "save-card",
        },
        {
          place: "save-card",
          kind: "system",
          title: "Save card",
          caption: "Card verified",
          touch: null,
          action: { actor: "system", affordance: "valid", wire: ':save-card "valid"', inferred: false },
          expect: "confirm",
        },
        {
          place: "confirm",
          kind: "screen",
          title: "Confirmation",
          caption: "Future invoices pay themselves",
          touch: null,
          action: null,
          expect: null,
        },
      ],
    });
  });

  test("a story with a missing hop is not runnable", () => {
    const result = build({ source: `(board "A" (screen :a "A") (screen :b "B")) (story "S" (step :a "1") (step :b "2"))` });
    if (!result.ok) throw new Error("did not compile");
    expect(scenarios(result)[0]?.runnable).toBe(false);
  });
});
