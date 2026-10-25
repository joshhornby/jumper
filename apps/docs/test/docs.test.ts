import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type DiagnosticCode, formatSource, type Severity } from "@jumper/lang";
import { readShareHash } from "../../playground/src/state.ts";
import { agentFiles, CONTENT_DIR, readPage } from "../src/agent.ts";
import { buildFence, type Fence, renderJumper, shareHash, splitFences } from "../src/markdown.ts";
import { pages } from "../src/pages.ts";

/** `satisfies` fails to compile when the language adds or drops a code, so this list cannot fall behind. */
const CODES = {
  "unclosed-string": "error",
  "unclosed-list": "error",
  "unmatched-paren": "error",
  "expected-form": "error",
  "expected-string": "error",
  "not-a-string": "error",
  "arrow-needs-space": "error",
  "argument-count": "error",
  "expected-target": "error",
  "missing-target": "error",
  "missing-condition": "error",
  "bad-wire-label": "error",
  "unexpected-value": "error",
  "missing-widget-name": "error",
  "unknown-widget": "error",
  "widget-not-allowed": "error",
  "bad-columns": "error",
  "missing-id": "error",
  "duplicate-id": "error",
  "unknown-form": "error",
  "duplicate-board": "error",
  "missing-board": "error",
  "story-holds-steps": "error",
  "bad-step-option": "error",
  "missing-option-value": "error",
  "duplicate-option": "error",
  "unknown-target": "gap",
  unreachable: "gap",
  "unknown-step-place": "gap",
  "unknown-touch": "gap",
  "unknown-via": "gap",
  "via-leads-elsewhere": "gap",
  "hop-without-wire": "gap",
  "ambiguous-hop": "gap",
  "empty-story": "gap",
  "via-on-last-step": "gap",
  "duplicate-affordance": "gap",
  "system-without-outcome": "gap",
  "decision-without-branches": "gap",
} as const satisfies Record<DiagnosticCode, Severity>;

const sources = pages.map((page) => ({ page, markdown: readPage({ slug: page.slug }) }));
const jumperFences = sources.flatMap(({ page, markdown }) =>
  splitFences(markdown)
    .fences.filter((fence) => fence.lang === "jumper")
    .map((fence, index) => ({ page, fence, name: `${page.slug} example ${index + 1}` })),
);

/** The same slugs as VitePress gives headings, for the headings these docs use. */
function slug(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");
}

function anchorsOf(markdown: string): Set<string> {
  const { text } = splitFences(markdown);
  return new Set([...text.matchAll(/^#{2,3} (.+)$/gm)].map(([, heading = ""]) => slug(heading)));
}

/** The Jumper fences under each `### code` heading of the diagnostic reference. */
function fencesByHeading(markdown: string): Map<string, Fence[]> {
  const result = new Map<string, Fence[]>();
  for (const part of markdown.split(/^### /m).slice(1)) {
    const heading = part.slice(0, part.indexOf("\n")).trim();
    result.set(
      heading,
      splitFences(part).fences.filter((fence) => fence.lang === "jumper"),
    );
  }
  return result;
}

describe("pages", () => {
  test("every page in the manifest has a file, and every file is in the manifest", () => {
    const files = readdirSync(CONTENT_DIR)
      .filter((file) => file.endsWith(".md"))
      .map((file) => file.replace(/\.md$/, ""))
      .sort();
    expect(files).toEqual(pages.map((page) => page.slug).sort());
  });

  test("each page starts with an h1 that matches its title", () => {
    for (const { page, markdown } of sources) expect(markdown.split("\n")[0]).toBe(`# ${page.title}`);
  });

  test("every link to a heading resolves", () => {
    const anchors = new Map(sources.map(({ page, markdown }) => [page.slug, anchorsOf(markdown)]));
    const broken: string[] = [];
    for (const { page, markdown } of sources) {
      for (const [, target = page.slug, hash = ""] of markdown.matchAll(/\]\((?:([\w-]+)\.md)?#([\w-]+)\)/g)) {
        if (!anchors.get(target)?.has(hash)) broken.push(`${page.slug} -> ${target}#${hash}`);
      }
    }
    expect(broken).toEqual([]);
  });

  test("the examples page shows each example file as it is in the repository", () => {
    const folder = join(import.meta.dir, "../../../packages/jumper/examples");
    const codes = splitFences(readPage({ slug: "examples" })).fences.map((fence) => fence.code);
    for (const file of readdirSync(folder)) expect(codes).toContain(readFileSync(join(folder, file), "utf8"));
  });
});

describe("examples", () => {
  test.each(jumperFences)("$name builds as its options say", ({ fence }) => {
    const result = buildFence(fence);
    if (fence.options.includes("check")) {
      expect(result.diagnostics.length).toBeGreaterThan(0);
    } else {
      expect(result.diagnostics).toEqual([]);
    }
  });

  test("lisp snippets read without a syntax error", () => {
    for (const { markdown } of sources) {
      for (const fence of splitFences(markdown).fences.filter((item) => item.lang === "lisp")) {
        expect(formatSource(fence.code).ok).toBe(true);
      }
    }
  });

  test("a rendered example draws the board and links to the playground", () => {
    const fence = { lang: "jumper", options: ["check"], code: '(board "A"\n  (screen :a "A"\n    (button "Go" -> :b)))\n' };
    const html = renderJumper({ fence, playground: "/jumper/playground/" });
    expect(html).toContain("<svg");
    expect(html).toContain('href="/jumper/playground/#s=');
    expect(html).toContain("UNKNOWN TARGET");
    expect(html).toContain("v-pre");
  });
});

describe("diagnostic reference", () => {
  const reference = readPage({ slug: "diagnostics" });
  const sections = fencesByHeading(reference);

  test.each(Object.entries(CODES))("%s has a section with an example that causes it", (code, severity) => {
    const fences = sections.get(code) ?? [];
    expect(fences.length).toBeGreaterThan(0);
    for (const fence of fences) {
      const found = buildFence(fence).diagnostics.find((diagnostic) => diagnostic.code === code);
      expect(found?.severity).toBe(severity);
    }
  });

  test("the summary table gives each code its real severity", () => {
    for (const [code, severity] of Object.entries(CODES)) {
      expect(reference).toMatch(new RegExp(`\\| \\[\`${code}\`\\]\\(#${code}\\) +\\| ${severity} +\\|`));
    }
  });
});

describe("agent files", () => {
  const files = agentFiles({ base: "https://docs.example/" });

  test("every page has a Markdown file", () => {
    for (const page of pages) expect(files.get(`${page.slug}.md`)?.startsWith(`# ${page.title}\n`)).toBe(true);
  });

  test("llms.txt links every page's Markdown with its description", () => {
    const index = files.get("llms.txt") ?? "";
    for (const page of pages) expect(index).toContain(`- [${page.title}](https://docs.example/${page.slug}.md): ${page.description}`);
  });

  test("agent Markdown writes out generated output, uses absolute links and drops site-only syntax", () => {
    const markdown = files.get("diagnostics.md") ?? "";
    expect(markdown).toContain("`jumper check board.jumper` prints:");
    expect(markdown).toContain("-- UNKNOWN TARGET");
    expect(markdown).toContain("](https://docs.example/widgets.md)");
    expect(markdown).not.toContain("<!--fence:");
    expect(files.get("getting-started.md")).not.toContain(":::");
  });

  test("llms-full.txt holds every page", () => {
    const full = files.get("llms-full.txt") ?? "";
    for (const page of pages) expect(full).toContain(`<!-- Source: https://docs.example/${page.slug}.md -->`);
  });
});

describe("playground links", () => {
  test("the playground opens the source from a docs share link", async () => {
    const source = '(board "Café £5"\n  (screen :a "A"))\n';
    expect(await readShareHash(shareHash(source))).toBe(source);
  });
});
