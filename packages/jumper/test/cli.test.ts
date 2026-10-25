import { describe, expect, test } from "bun:test";
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
});
