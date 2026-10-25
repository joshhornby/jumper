import { cp, rm } from "node:fs/promises";
import { join } from "node:path";

/**
 * Builds the GitHub Pages site: the docs at the root and the playground at `playground/`.
 * The output is apps/docs/dist. Set DOCS_BASE and DOCS_URL to deploy somewhere other than jumper.joshhornby.com.
 */
const root = join(import.meta.dir, "..");
const docs = join(root, "apps/docs/dist");
const playground = join(root, "apps/playground/dist");

async function run(command: string[]): Promise<void> {
  const child = Bun.spawn(command, { cwd: root, stdout: "inherit", stderr: "inherit" });
  if ((await child.exited) !== 0) throw new Error(`${command.join(" ")} failed.`);
}

// The playground build does not clear its folder, so old bundles would ship too.
await rm(playground, { recursive: true, force: true });
await run(["bun", "--filter", "docs", "build"]);
await run(["bun", "--filter", "playground", "build"]);
await cp(playground, join(docs, "playground"), { recursive: true });
console.log(`Site ready in ${docs}`);
