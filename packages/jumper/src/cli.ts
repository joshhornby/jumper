#!/usr/bin/env bun
import { parseArgs } from "node:util";
import { describeDiff, diff } from "./diff.ts";
import { formatDiagnostic, summarise } from "./format.ts";
import { type BuildResult, build, type Diagnostic, formatSource, positionAt, scenarios } from "./index.ts";

const USAGE = `Usage:
  jumper check <file.jumper> [--json]
  jumper build <file.jumper> [-o out.svg] [--breadboard] [--no-notes] [--story <n>]
  jumper fmt <file.jumper> [--write | --check]
  jumper diff <before.jumper> <after.jumper> [--json]
  jumper scenarios <file.jumper>`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: "string", short: "o" },
    breadboard: { type: "boolean", default: false },
    "no-notes": { type: "boolean", default: false },
    story: { type: "string" },
    json: { type: "boolean", default: false },
    write: { type: "boolean", default: false },
    check: { type: "boolean", default: false },
  },
});

function report({ file, source, diagnostics }: { file: string; source: string; diagnostics: Diagnostic[] }): void {
  const colour = process.stderr.isTTY === true && !("NO_COLOR" in process.env);
  for (const diagnostic of diagnostics) {
    process.stderr.write(`${formatDiagnostic({ source, file, diagnostic, colour })}\n\n`);
  }
}

/**
 * Positions are added so that a consumer without the source can still show line and column.
 * The board and analysis are included when the board compiled, so that agents can read the behaviour.
 */
function json({ file, source, result }: { file: string; source: string; result: BuildResult }): string {
  const diagnostics = result.diagnostics.map((diagnostic) => ({
    ...diagnostic,
    start: positionAt({ source, offset: diagnostic.span.start }),
    end: positionAt({ source, offset: diagnostic.span.end }),
  }));
  const body = result.ok ? { file, diagnostics, board: result.board, analysis: result.analysis } : { file, diagnostics };
  return `${JSON.stringify(body, null, 2)}\n`;
}

async function load(file: string): Promise<string> {
  const input = Bun.file(file);
  if (!(await input.exists())) {
    process.stderr.write(`I cannot find the file ${file}.\n`);
    process.exit(2);
  }
  return input.text();
}

async function check([file]: string[]): Promise<number> {
  if (file === undefined) return usage();
  const source = await load(file);
  const result = build({ source });
  if (values.json) {
    process.stdout.write(json({ file, source, result }));
  } else {
    report({ file, source, diagnostics: result.diagnostics });
    process.stderr.write(`${summarise(result.diagnostics)}\n`);
  }
  return result.diagnostics.length === 0 ? 0 : 1;
}

async function buildSvg([file]: string[]): Promise<number> {
  if (file === undefined) return usage();
  const source = await load(file);
  const result = build({
    source,
    fidelity: values.breadboard ? "breadboard" : "wireframe",
    showNotes: !values["no-notes"],
    story: values.story === undefined ? null : Number(values.story) - 1,
  });
  report({ file, source, diagnostics: result.diagnostics });
  if (!result.ok) return 1;
  if (values.out === undefined) process.stdout.write(result.svg);
  else await Bun.write(values.out, result.svg);
  return 0;
}

async function fmt([file]: string[]): Promise<number> {
  if (file === undefined) return usage();
  const source = await load(file);
  const result = formatSource(source);
  if (!result.ok) {
    report({ file, source, diagnostics: result.diagnostics });
    return 1;
  }
  if (values.check) {
    if (result.text === source) return 0;
    process.stderr.write(`${file} is not formatted. Run jumper fmt --write ${file}.\n`);
    return 1;
  }
  if (values.write) {
    if (result.text !== source) await Bun.write(file, result.text);
    return 0;
  }
  process.stdout.write(result.text);
  return 0;
}

/** Both versions must compile, because a diff of a broken board would compare guesses. */
async function difference([first, second]: string[]): Promise<number> {
  if (first === undefined || second === undefined) return usage();
  const sides = await Promise.all(
    [first, second].map(async (file) => {
      const source = await load(file);
      const result = build({ source });
      if (!result.ok) report({ file, source, diagnostics: result.diagnostics });
      return result.ok ? result : null;
    }),
  );
  const [before = null, after = null] = sides;
  if (before === null || after === null) return 1;
  const change = diff({ before, after });
  process.stdout.write(values.json ? `${JSON.stringify(change, null, 2)}\n` : `${describeDiff(change)}\n`);
  return 0;
}

async function scenarioList([file]: string[]): Promise<number> {
  if (file === undefined) return usage();
  const source = await load(file);
  const result = build({ source });
  report({ file, source, diagnostics: result.diagnostics });
  if (!result.ok) return 1;
  process.stdout.write(`${JSON.stringify(scenarios(result), null, 2)}\n`);
  return 0;
}

function usage(): number {
  process.stderr.write(`${USAGE}\n`);
  return 2;
}

const COMMANDS: Record<string, (files: string[]) => Promise<number>> = {
  check,
  build: buildSvg,
  fmt,
  diff: difference,
  scenarios: scenarioList,
};

const [command = "", ...files] = positionals;
const run = Object.hasOwn(COMMANDS, command) ? COMMANDS[command] : undefined;
// Set the code instead of calling exit, so that a large SVG on stdout is not cut short.
process.exitCode = run === undefined ? usage() : await run(files);
