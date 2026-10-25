import { describe, expect, test } from "bun:test";
import { examples } from "../src/examples.ts";
import { analyse, build, compile, positionAt } from "../src/index.ts";

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

function boardOf(source: string) {
  const { board, diagnostics } = compile(source);
  if (board === null) throw new Error(diagnostics.map((diagnostic) => diagnostic.message).join("\n"));
  return board;
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
    expect([...analyse(board).unreachable]).toEqual(["x", "y"]);
  });

  test("a place downstream of an orphan loop is unreachable, and the message does not say it is in the loop", () => {
    const source = `(board "A" (screen :s "S") (screen :x "X" (link "y" -> :y)) (screen :y "Y" (link "x" -> :x) (link "z" -> :z)) (screen :z "Z"))`;
    expect(messages(source)).toContain("gap: Z is unreachable. No entry point leads to it.");
  });

  test("every place with no incoming wire counts as an entry point", () => {
    const board = boardOf(`(board "A" (screen :a "A") (screen :b "B"))`);
    expect(analyse(board).unreachable.size).toBe(0);
  });
});

describe("stories", () => {
  test("a hop without :via is inferred when exactly one wire fits", () => {
    const board = boardOf(classic);
    const [path] = analyse(board).stories;
    expect(path?.hops.map((hop) => hop.kind)).toEqual(["explicit", "explicit", "explicit"]);

    const inferred = boardOf(classic.replace(':via "valid"', ""));
    expect(analyse(inferred).stories[0]?.hops[2]?.kind).toBe("inferred");
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
    expect(analyse(board).stories[0]?.highlights).toEqual([1, 0, 0, null]);
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
