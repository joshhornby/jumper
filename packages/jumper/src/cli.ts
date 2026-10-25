#!/usr/bin/env bun
import { parseArgs } from "node:util";
import { formatDiagnostic, summarise } from "./format.ts";
import { build, type Diagnostic, positionAt } from "./index.ts";

const USAGE = `Usage:
  jumper check <file.jumper> [--json]
  jumper build <file.jumper> [-o out.svg] [--breadboard] [--no-notes] [--story <n>]`;

function report({ file, source, diagnostics }: { file: string; source: string; diagnostics: Diagnostic[] }): void {
  const colour = process.stderr.isTTY === true && !("NO_COLOR" in process.env);
  for (const diagnostic of diagnostics) {
    process.stderr.write(`${formatDiagnostic({ source, file, diagnostic, colour })}\n\n`);
  }
}

/** Positions are added so that a consumer without the source can still show line and column. */
function json({ file, source, diagnostics }: { file: string; source: string; diagnostics: Diagnostic[] }): string {
  const located = diagnostics.map((diagnostic) => ({
    ...diagnostic,
    start: positionAt({ source, offset: diagnostic.span.start }),
    end: positionAt({ source, offset: diagnostic.span.end }),
  }));
  return `${JSON.stringify({ file, diagnostics: located }, null, 2)}\n`;
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: "string", short: "o" },
    breadboard: { type: "boolean", default: false },
    "no-notes": { type: "boolean", default: false },
    story: { type: "string" },
    json: { type: "boolean", default: false },
  },
});

const [command, file] = positionals;
if ((command !== "check" && command !== "build") || file === undefined) {
  process.stderr.write(`${USAGE}\n`);
  process.exit(2);
}

const input = Bun.file(file);
if (!(await input.exists())) {
  process.stderr.write(`I cannot find the file ${file}.\n`);
  process.exit(2);
}
const source = await input.text();
const story = values.story === undefined ? null : Number(values.story) - 1;
const result = build({
  source,
  fidelity: values.breadboard ? "breadboard" : "wireframe",
  showNotes: !values["no-notes"],
  story,
});

if (command === "check") {
  if (values.json) {
    process.stdout.write(json({ file, source, diagnostics: result.diagnostics }));
  } else {
    report({ file, source, diagnostics: result.diagnostics });
    process.stderr.write(`${summarise(result.diagnostics)}\n`);
  }
  process.exit(result.diagnostics.length === 0 ? 0 : 1);
}

report({ file, source, diagnostics: result.diagnostics });
if (!result.ok) process.exit(1);
if (values.out === undefined) {
  process.stdout.write(result.svg);
} else {
  await Bun.write(values.out, result.svg);
}
