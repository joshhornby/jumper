#!/usr/bin/env bun
import { parseArgs } from "node:util";
import { build, type Diagnostic, positionAt } from "./index.ts";

const USAGE = `Usage:
  jumper check <file.jumper>
  jumper build <file.jumper> [-o out.svg] [--breadboard] [--no-notes] [--story <n>]`;

function report({ file, source, diagnostics }: { file: string; source: string; diagnostics: Diagnostic[] }): void {
  for (const diagnostic of diagnostics) {
    const { line, column } = positionAt({ source, offset: diagnostic.span.start });
    process.stderr.write(`${file}:${line}:${column} ${diagnostic.severity}: ${diagnostic.message}\n`);
  }
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: "string", short: "o" },
    breadboard: { type: "boolean", default: false },
    "no-notes": { type: "boolean", default: false },
    story: { type: "string" },
  },
});

const [command, file] = positionals;
if ((command !== "check" && command !== "build") || file === undefined) {
  process.stderr.write(`${USAGE}\n`);
  process.exit(2);
}

const source = await Bun.file(file).text();
const story = values.story === undefined ? null : Number(values.story) - 1;
const result = build({
  source,
  fidelity: values.breadboard ? "breadboard" : "wireframe",
  showNotes: !values["no-notes"],
  story,
});
report({ file, source, diagnostics: result.diagnostics });

if (!result.ok) process.exit(1);
if (command === "check") {
  const gaps = result.diagnostics.length;
  process.stderr.write(gaps === 0 ? "No gaps.\n" : `${gaps} gap${gaps === 1 ? "" : "s"}.\n`);
  process.exit(gaps === 0 ? 0 : 1);
}
if (values.out === undefined) {
  process.stdout.write(result.svg);
} else {
  await Bun.write(values.out, result.svg);
}
