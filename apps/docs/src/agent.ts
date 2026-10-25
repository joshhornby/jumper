import { readFileSync } from "node:fs";
import { join } from "node:path";
import { agentMarkdown } from "./markdown.ts";
import { pages, sections } from "./pages.ts";

export const CONTENT_DIR = join(import.meta.dirname, "../content");

export const SUMMARY =
  "Jumper is a small language for user flows and wireframes. You write S-expressions. Jumper draws the board and storyboards as SVG, and checks that every story follows a real wire.";

export function readPage({ slug, contentDir = CONTENT_DIR }: { slug: string; contentDir?: string }): string {
  return readFileSync(join(contentDir, `${slug}.md`), "utf8");
}

/** The llms.txt index: a title, a summary, then one link per page under each section. */
function llmsTxt(base: string): string {
  const lines = [
    "# Jumper",
    "",
    `> ${SUMMARY}`,
    "",
    "Each page below is Markdown. Generated output, such as `jumper check` text, is written out in full.",
    `All pages in one file: ${base}llms-full.txt`,
  ];
  for (const section of sections) {
    lines.push("", `## ${section.title}`, "");
    for (const page of section.pages) lines.push(`- [${page.title}](${base}${page.slug}.md): ${page.description}`);
  }
  return `${lines.join("\n")}\n`;
}

/**
 * The files for agents, by path: one Markdown file for each page, `llms.txt` and `llms-full.txt`.
 * `base` is the site's public URL, such as `https://joshhornby.github.io/jumper/`, so links work outside the site.
 */
export function agentFiles({ base, contentDir = CONTENT_DIR }: { base: string; contentDir?: string }): Map<string, string> {
  const files = new Map<string, string>();
  const full: string[] = [`# Jumper documentation\n\n> ${SUMMARY}\n`];
  for (const page of pages) {
    const markdown = agentMarkdown({ markdown: readPage({ slug: page.slug, contentDir }), base });
    files.set(`${page.slug}.md`, markdown);
    full.push(`<!-- Source: ${base}${page.slug}.md -->\n\n${markdown}`);
  }
  files.set("llms.txt", llmsTxt(base));
  files.set("llms-full.txt", full.join("\n---\n\n"));
  return files;
}
