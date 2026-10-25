#!/usr/bin/env bun
import { parseArgs } from "node:util";
import { formatDiagnostic, summarise } from "./format.ts";
import { type BuildResult, build, type Diagnostic, formatSource, positionAt } from "./index.ts";

const USAGE = `Usage:
  jumper check <file.jumper> [--json]
  jumper build <file.jumper> [-o out.svg] [--breadboard] [--no-notes] [--story <n>]
  jumper fmt <file.jumper> [--write | --check]`;

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

async function check(file: string): Promise<number> {
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

async function buildSvg(file: string): Promise<number> {
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

async function fmt(file: string): Promise<number> {
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

const COMMANDS: Record<string, (file: string) => Promise<number>> = { check, build: buildSvg, fmt };

const [command = "", file] = positionals;
const run = Object.hasOwn(COMMANDS, command) ? COMMANDS[command] : undefined;
if (run === undefined || file === undefined) {
  process.stderr.write(`${USAGE}\n`);
  process.exit(2);
}
// Set the code instead of calling exit, so that a large SVG on stdout is not cut short.
process.exitCode = await run(file);
