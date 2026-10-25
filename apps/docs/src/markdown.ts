import { deflateRawSync } from "node:zlib";
import { type BuildResult, build, formatDiagnostic, formatSource, scenarios, summarise } from "@jumper/lang";
import { escapeHtml, highlightJumper } from "./highlight.ts";

/**
 * A fenced code block. `lang` is the first word of the info string. The other words are options:
 * on a `jumper` fence they are `check`, `fmt`, `scenarios`, `source`, `breadboard` and `story=<n>`.
 */
export type Fence = { lang: string; options: string[]; code: string };

/** The file name shown in generated `jumper check` output. */
export const EXAMPLE_FILE = "board.jumper";

export function parseInfo({ info, code }: { info: string; code: string }): Fence {
  const [lang = "", ...options] = info.trim().split(/\s+/);
  return { lang, options, code };
}

const OPEN = /^```(.*)$/;
const CLOSE = /^```\s*$/;

/**
 * Takes each fenced block out of the Markdown and leaves a marker in its place.
 * Only fences that start at column 0 count, which is all the docs use.
 */
export function splitFences(markdown: string): { text: string; fences: Fence[] } {
  const lines = markdown.split("\n");
  const out: string[] = [];
  const fences: Fence[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const open = OPEN.exec(lines[index] ?? "");
    if (open === null) {
      out.push(lines[index] ?? "");
      continue;
    }
    const body: string[] = [];
    index += 1;
    while (index < lines.length && !CLOSE.test(lines[index] ?? "")) {
      body.push(lines[index] ?? "");
      index += 1;
    }
    out.push(`<!--fence:${fences.length}-->`);
    fences.push(parseInfo({ info: open[1] ?? "", code: `${body.join("\n")}\n` }));
  }
  return { text: out.join("\n"), fences };
}

export function storyOption(fence: Fence): number | null {
  const option = fence.options.find((item) => item.startsWith("story="));
  return option === undefined ? null : Number(option.slice("story=".length)) - 1;
}

export function buildFence(fence: Fence): BuildResult {
  return build({
    source: fence.code,
    fidelity: fence.options.includes("breadboard") ? "breadboard" : "wireframe",
    story: storyOption(fence),
  });
}

/** The text `jumper check` writes for this source, without colour. */
export function checkOutput(source: string): string {
  const { diagnostics } = build({ source });
  const blocks = diagnostics.map((diagnostic) => formatDiagnostic({ source, file: EXAMPLE_FILE, diagnostic }));
  return [...blocks, summarise(diagnostics)].join("\n\n");
}

function scenarioOutput(result: BuildResult): string {
  return result.ok ? JSON.stringify(scenarios(result), null, 2) : "";
}

function formatOutput(source: string): string {
  const result = formatSource(source);
  return result.ok ? result.text : source;
}

/** Matches the playground's `#s=` share format: deflate-raw JSON in base64url. */
export function shareHash(source: string): string {
  return `#s=${deflateRawSync(JSON.stringify({ source })).toString("base64url")}`;
}

function panel({ label, html, extra = "" }: { label: string; html: string; extra?: string }): string {
  return `<div class="jumper-panel"><div class="jumper-bar"><span>${escapeHtml(label)}</span>${extra}</div><pre><code>${html}</code></pre></div>`;
}

/**
 * Renders a `jumper` fence for people: the highlighted source, any generated output, and the drawn board.
 * `v-pre` stops Vue from reading the HTML as a template. `target` keeps the docs router off the playground link.
 */
export function renderJumper({ fence, playground }: { fence: Fence; playground: string }): string {
  const result = buildFence(fence);
  const link = `<a class="jumper-link" href="${escapeHtml(playground + shareHash(fence.code))}" target="_blank" rel="noopener">Open in playground</a>`;
  const parts = [panel({ label: "jumper", html: highlightJumper(fence.code), extra: link })];
  if (fence.options.includes("check")) {
    parts.push(panel({ label: `$ jumper check ${EXAMPLE_FILE}`, html: escapeHtml(checkOutput(fence.code)) }));
  }
  if (fence.options.includes("fmt")) {
    parts.push(panel({ label: `$ jumper fmt ${EXAMPLE_FILE}`, html: highlightJumper(formatOutput(fence.code)) }));
  }
  if (fence.options.includes("scenarios") && result.ok) {
    parts.push(panel({ label: `$ jumper scenarios ${EXAMPLE_FILE}`, html: escapeHtml(scenarioOutput(result)) }));
  }
  if (!fence.options.includes("source") && result.ok) {
    parts.push(`<figure class="jumper-board" style="--board-width: ${result.width}px">${result.svg}</figure>`);
  }
  return `<div class="jumper-example" v-pre>${parts.join("")}</div>\n`;
}

function agentFence(fence: Fence): string {
  if (fence.lang !== "jumper") return `\`\`\`${[fence.lang, ...fence.options].join(" ")}\n${fence.code}\`\`\``;
  const parts = [`\`\`\`jumper\n${fence.code}\`\`\``];
  if (fence.options.includes("check")) {
    parts.push(`\`jumper check ${EXAMPLE_FILE}\` prints:\n\n\`\`\`text\n${checkOutput(fence.code)}\n\`\`\``);
  }
  if (fence.options.includes("fmt")) {
    parts.push(`\`jumper fmt ${EXAMPLE_FILE}\` prints:\n\n\`\`\`jumper\n${formatOutput(fence.code)}\`\`\``);
  }
  if (fence.options.includes("scenarios")) {
    const output = scenarioOutput(buildFence(fence));
    if (output !== "") parts.push(`\`jumper scenarios ${EXAMPLE_FILE}\` prints:\n\n\`\`\`json\n${output}\n\`\`\``);
  }
  return parts.join("\n\n");
}

/**
 * Renders a page for agents. Generated output, such as `jumper check` text, is written out in full,
 * because an agent cannot see the drawn board. With `base`, links to other pages become absolute.
 */
export function agentMarkdown({ markdown, base }: { markdown: string; base: string }): string {
  const { text, fences } = splitFences(markdown);
  return (
    text
      .replace(/<!--fence:(\d+)-->/g, (_, index: string) => {
        const fence = fences[Number(index)];
        return fence === undefined ? "" : agentFence(fence);
      })
      // VitePress containers, such as `::: code-group`, mean nothing outside the site.
      .replace(/^:::.*\n/gm, "")
      .replace(/\]\(([\w-]+\.md(?:#[\w-]*)?)\)/g, (_, target: string) => `](${base}${target})`)
      .trimEnd()
      .concat("\n")
  );
}
