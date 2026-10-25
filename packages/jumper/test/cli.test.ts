import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CLI = join(import.meta.dir, "../src/cli.ts");
const EXAMPLES = join(import.meta.dir, "../examples");

function run(args: string[]): { code: number; stdout: string; stderr: string } {
  const result = Bun.spawnSync(["bun", CLI, ...args], { env: { ...process.env, NO_COLOR: "1" } });
  return { code: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
}

describe("cli", () => {
  test("check on a clean board exits 0", () => {
    const result = run(["check", join(EXAMPLES, "autopay.jumper")]);
    expect(result.code).toBe(0);
    expect(result.stderr).toBe("No errors and no gaps.\n");
  });

  test("check prints each gap with its source and exits 1", () => {
    const result = run(["check", join(EXAMPLES, "broken.jumper")]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("-- UNKNOWN TARGET");
    expect(result.stderr).toContain('(primary "Pay" -> :receipt)');
    expect(result.stderr.trimEnd().endsWith("7 gaps.")).toBe(true);
  });

  test("check --json prints structured diagnostics with positions", () => {
    const result = run(["check", join(EXAMPLES, "broken.jumper"), "--json"]);
    const parsed: unknown = JSON.parse(result.stdout);
    expect(parsed).toMatchObject({
      diagnostics: expect.arrayContaining([expect.objectContaining({ code: "unknown-target", start: { line: 9, column: 25 } })]),
    });
  });

  test("a missing file is reported without a stack trace", () => {
    const result = run(["check", "no-such-file.jumper"]);
    expect(result.code).toBe(2);
    expect(result.stderr).toBe("I cannot find the file no-such-file.jumper.\n");
  });
  test("check --json includes the board and analysis when the board compiles", () => {
    const result = run(["check", join(EXAMPLES, "autopay.jumper"), "--json"]);
    expect(JSON.parse(result.stdout)).toMatchObject({
      board: { title: "Invoice autopay" },
      analysis: { wires: expect.arrayContaining([expect.objectContaining({ key: ':invoice "Turn on Autopay"', to: "setup" })]) },
    });
  });
  test("build writes the SVG to stdout", () => {
    const result = run(["build", join(EXAMPLES, "autopay.jumper"), "--story", "1"]);
    expect(result.code).toBe(0);
    expect(result.stdout.startsWith("<svg")).toBe(true);
    expect(result.stdout.endsWith("</svg>")).toBe(true);
  });

  test("fmt --check passes on the examples, and --write formats a file in place", () => {
    expect(run(["fmt", join(EXAMPLES, "password-reset.jumper"), "--check"]).code).toBe(0);
    const file = join(mkdtempSync(join(tmpdir(), "jumper-")), "messy.jumper");
    writeFileSync(file, `(board "A"   (screen :a "A" (text "x")))`);
    expect(run(["fmt", file, "--check"]).code).toBe(1);
    expect(run(["fmt", file, "--write"]).code).toBe(0);
    expect(readFileSync(file, "utf8")).toBe(`(board "A"\n  (screen :a "A"\n    (text "x")))\n`);
  });

  test("an unknown command prints the usage", () => {
    const result = run(["paint", "x.jumper"]);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("Usage:");
  });
  test("diff describes the change between two files", () => {
    const folder = mkdtempSync(join(tmpdir(), "jumper-"));
    const before = join(folder, "before.jumper");
    const after = join(folder, "after.jumper");
    writeFileSync(before, `(board "A" (screen :a "A" (button "Go" -> :b)) (screen :b "B") (screen :c "C"))`);
    writeFileSync(after, `(board "A" (screen :a "A" (button "Go" -> :c)) (screen :b "B") (screen :c "C"))`);
    const result = run(["diff", before, after]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain(':a "Go" now leads to :c, not :b');
    expect(JSON.parse(run(["diff", before, after, "--json"]).stdout)).toMatchObject({ wires: { retargeted: [{ key: ':a "Go"' }] } });
  });
});
