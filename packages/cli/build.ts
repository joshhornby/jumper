import { chmod, rm } from "node:fs/promises";
import { join } from "node:path";

const out = join(import.meta.dir, "dist");
await rm(out, { recursive: true, force: true });

// One file for Node with the language bundled in, so a global install needs neither Bun nor other packages.
const result = await Bun.build({
  entrypoints: [join(import.meta.dir, "src/cli.ts")],
  outdir: out,
  target: "node",
  format: "esm",
  banner: "#!/usr/bin/env node",
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
await chmod(join(out, "cli.js"), 0o755);
