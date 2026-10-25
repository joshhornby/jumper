export type Page = {
  /** The file name in `docs/` without `.md`. It is also the page's URL. */
  slug: string;
  title: string;
  /** One sentence. It shows in search, in `llms.txt` and in the page's meta description. */
  description: string;
};

export type Section = { title: string; pages: Page[] };

/** The order here is the reading order: the sidebar, the pager and `llms-full.txt` all follow it. */
export const sections: readonly Section[] = [
  {
    title: "Getting started",
    pages: [
      { slug: "index", title: "Introduction", description: "What Jumper is, what it checks and who it is for." },
      { slug: "getting-started", title: "Getting started", description: "Install Jumper, write a first board, check it and draw it." },
      {
        slug: "playground-guide",
        title: "The playground",
        description: "Edit a board in the browser and see the board, stories and problems update.",
      },
    ],
  },
  {
    title: "Syntax & concepts",
    pages: [
      {
        slug: "concepts",
        title: "Core concepts",
        description: "Boards, places, affordances, wires, stories and gaps, and how they fit together.",
      },
      { slug: "syntax", title: "Syntax", description: "Forms, strings, ids, arrows and comments: the rules every Jumper file follows." },
      {
        slug: "boards",
        title: "Boards and regions",
        description: "The board form, and regions that group places around one design question.",
      },
      { slug: "places", title: "Places", description: "Screens, slots, systems and decisions: the five place forms and what each holds." },
      { slug: "widgets", title: "Widgets", description: "Every widget a place can hold, with its arguments and how it is drawn." },
      { slug: "wires", title: "Wires", description: "Connect an affordance to a place with ->, label the wire and name it in a story." },
      { slug: "stories", title: "Stories", description: "Write a story as steps across places, and let Jumper prove each hop has a wire." },
    ],
  },
  {
    title: "Checking",
    pages: [
      {
        slug: "checks",
        title: "Errors and gaps",
        description: "The two kinds of problem, what each one stops, and what Jumper does not report.",
      },
      {
        slug: "diagnostics",
        title: "Diagnostic reference",
        description: "Every diagnostic code, its severity, an example that causes it and how to fix it.",
      },
    ],
  },
  {
    title: "Reference",
    pages: [
      { slug: "cli", title: "CLI reference", description: "Every jumper command, option and exit code." },
      {
        slug: "json",
        title: "JSON output",
        description: "The shape of check --json, diff --json and scenarios output, for tools and agents.",
      },
      {
        slug: "api",
        title: "TypeScript API",
        description: "Use @jumper/lang to compile, check, render, format and compare boards in code.",
      },
      { slug: "formatting", title: "Formatting", description: "The canonical layout that jumper fmt prints." },
    ],
  },
  {
    title: "Guides",
    pages: [
      {
        slug: "designing",
        title: "Designing a flow",
        description: "Go from a feature idea to a board and stories that a team can build from.",
      },
      {
        slug: "agents",
        title: "Using Jumper with agents",
        description: "A loop for coding agents: write, check as JSON, apply fixes, format.",
      },
      { slug: "testing", title: "From stories to tests", description: "Turn each story into a test scenario with jumper scenarios." },
      { slug: "ci", title: "Review and CI", description: "Check, format and compare boards in pull requests." },
      { slug: "examples", title: "Examples", description: "Complete boards to read, copy and change." },
    ],
  },
];

export const pages: readonly Page[] = sections.flatMap((section) => section.pages);

export function sectionOf(page: Page): Section | undefined {
  return sections.find((section) => section.pages.includes(page));
}
