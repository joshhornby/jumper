import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { defineConfig } from "vitepress";
import { agentFiles } from "../src/agent.ts";
import { parseInfo, renderJumper } from "../src/markdown.ts";
import { pages, sections } from "../src/pages.ts";

const base = process.env["DOCS_BASE"] ?? "/";
const siteUrl = process.env["DOCS_URL"] ?? "https://jumper.joshhornby.com/";
const dev = process.argv.includes("dev");
// In production the playground is deployed inside the docs. In dev it runs on its own server.
const playgroundEnv = process.env["JUMPER_PLAYGROUND_URL"] ?? (dev ? "http://localhost:3000/" : undefined);
const playground = playgroundEnv ?? `${base}playground/`;
// Nav links get the base added, so the nav takes the path without it.
const playgroundNav = playgroundEnv ?? "/playground/";
const repository = "https://github.com/joshhornby/jumper";

const bySlug = new Map(pages.map((page) => [page.slug, page]));

function slugOf(relativePath: string): string {
  return relativePath.replace(/\.md$/, "");
}

function contentType(path: string): string {
  return path.endsWith(".md") ? "text/markdown; charset=utf-8" : "text/plain; charset=utf-8";
}

export default defineConfig({
  title: "Jumper",
  description: "A small language for user flows and wireframes.",
  lang: "en-GB",
  base,
  srcDir: "content",
  outDir: "dist",
  cleanUrls: true,
  lastUpdated: false,
  ignoreDeadLinks: "localhostLinks",

  transformPageData(pageData) {
    const page = bySlug.get(slugOf(pageData.relativePath));
    if (page !== undefined) pageData.description = page.description;
  },

  transformHead({ pageData }) {
    return [["link", { rel: "alternate", type: "text/markdown", href: `${base}${pageData.relativePath}`, title: "This page as Markdown" }]];
  },

  markdown: {
    config(md) {
      const fallback = md.renderer.rules.fence;
      md.renderer.rules.fence = (tokens, index, options, env, self) => {
        const token = tokens[index];
        const fence = parseInfo({ info: token?.info ?? "", code: token?.content ?? "" });
        if (fence.lang === "jumper") return renderJumper({ fence, playground });
        return fallback ? fallback(tokens, index, options, env, self) : self.renderToken(tokens, index, options);
      };
    },
  },

  async buildEnd(siteConfig) {
    const files = agentFiles({ base: siteUrl });
    await Promise.all([...files].map(([path, body]) => writeFile(join(siteConfig.outDir, path), body)));
  },

  vite: {
    plugins: [
      {
        name: "jumper-agent-files",
        // The same files as the build writes, read fresh on each request so edits show at once.
        configureServer(server) {
          server.middlewares.use((request, response, next) => {
            const path = (request.url ?? "").split(/[?#]/)[0]?.replace(base, "") ?? "";
            if (!path.endsWith(".md") && !path.startsWith("llms")) return next();
            const body = agentFiles({ base: siteUrl }).get(path);
            if (body === undefined) return next();
            response.setHeader("content-type", contentType(path));
            response.end(body);
          });
        },
      },
    ],
  },

  themeConfig: {
    nav: [
      {
        text: "Guide",
        link: "/getting-started",
        activeMatch: "^/(getting-started|playground-guide|concepts|syntax|boards|places|widgets|wires|stories)",
      },
      { text: "Reference", link: "/cli", activeMatch: "^/(cli|json|api|formatting|checks|diagnostics)" },
      { text: "Playground", link: playgroundNav, target: "_self" },
      // Only page links get the base added, so this one carries it.
      { text: "llms.txt", link: `${base}llms.txt`, target: "_self" },
    ],
    sidebar: sections.map((section) => ({
      text: section.title,
      items: section.pages.map((page) => ({ text: page.title, link: page.slug === "index" ? "/" : `/${page.slug}` })),
    })),
    search: { provider: "local" },
    socialLinks: [{ icon: "github", link: repository }],
    editLink: { pattern: `${repository}/edit/main/apps/docs/content/:path`, text: "Edit this page on GitHub" },
    outline: [2, 3],
    footer: { message: "Released under the MIT Licence." },
  },
});
