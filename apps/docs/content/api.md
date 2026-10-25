# TypeScript API

The language is a TypeScript library, `@jumper/lang`, in `packages/jumper`. The CLI, the playground and these docs all use it.

> `@jumper/lang` is a workspace package in the repository. It is not published to npm yet. To use it, add it to a package in the workspace with `"@jumper/lang": "workspace:*"`. The library is TypeScript source and runs on Bun or through a bundler.

## build

`build` compiles, checks and draws a board in one call. Most tools need only this function.

```ts
import { build } from "@jumper/lang";

const result = build({ source, fidelity: "wireframe", showNotes: true, story: null });

if (result.ok) {
  console.log(result.svg, result.width, result.height);
  console.log(result.board.places.length, result.analysis.wires.length);
}
for (const diagnostic of result.diagnostics) console.log(diagnostic.code, diagnostic.message);
```

| Option      | Type                            | Default       | Meaning                                                                               |
| ----------- | ------------------------------- | ------------- | ------------------------------------------------------------------------------------- |
| `source`    | `string`                        | Required      | The Jumper source.                                                                    |
| `fidelity`  | `"wireframe"` or `"breadboard"` | `"wireframe"` | How to draw screens.                                                                  |
| `showNotes` | `boolean`                       | `true`        | Draw notes and questions.                                                             |
| `story`     | `number` or `null`              | `null`        | The index of the story to draw, from 0. An index with no story draws the board alone. |

`build` returns a `BuildResult`:

```ts
type BuildResult =
  | { ok: true; board: Board; analysis: Analysis; svg: string; width: number; height: number; diagnostics: Diagnostic[] }
  | { ok: false; diagnostics: Diagnostic[] };
```

`ok` is `false` only when the source has an error. Gaps are in `diagnostics` either way. When `ok` is `false`, `diagnostics` holds the errors, and then the gaps that Jumper found in the rest of the board.

## Lower-level functions

Use these to run one stage at a time.

| Function  | Signature                                                       | Use                                                                                         |
| --------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `read`    | `(source: string) => ReadResult`                                | Read S-expressions. Returns `exprs`, `comments` and syntax `diagnostics`.                   |
| `compile` | `(source: string) => CompileResult`                             | Read and compile to a `Board`. On errors, `partial` holds the board that Jumper could read. |
| `analyse` | `({ board, incomplete? }) => Analysis`                          | Check wires and stories. Returns wires, story paths and gaps.                               |
| `render`  | `({ board, analysis, fidelity, showNotes, story }) => Rendered` | Draw SVG. Returns `svg`, `width` and `height`.                                              |

The [JSON output](json.md) page describes `Board`, `Analysis` and `Diagnostic` field by field.

## Formatting

```ts
import { formatSource } from "@jumper/lang";

const result = formatSource(source);
if (result.ok) await Bun.write("board.jumper", result.text);
```

`formatSource` returns `{ ok: true; text }`, or `{ ok: false; diagnostics }` on a syntax error. See [Formatting](formatting.md).

## Diagnostics

| Function                                                  | Use                                                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `formatDiagnostic({ source, file, diagnostic, colour? })` | The text `jumper check` prints for one diagnostic.                                          |
| `summarise(diagnostics)`                                  | The last line of `jumper check`, such as `1 error and 2 gaps.`                              |
| `positionAt({ source, offset })`                          | Turn an offset into a 1-based `{ line, column }`.                                           |
| `applyEdits({ source, edits })`                           | Apply fix edits. Later edits go first, and an edit that overlaps an applied one is skipped. |

Apply every safe fix in a file:

```ts
import { applyEdits, build } from "@jumper/lang";

const edits = build({ source }).diagnostics.flatMap((diagnostic) => (diagnostic.fix?.edit ? [diagnostic.fix.edit] : []));
const fixed = applyEdits({ source, edits });
```

## Compare and test

| Function                         | Use                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| `diff({ before, after })`        | Compare two compiled boards. Pass the `ok` results of `build`. Returns a `BoardDiff`. |
| `describeDiff(change)`           | The text `jumper diff` prints.                                                        |
| `scenarios({ board, analysis })` | Turn each story into a `Scenario`.                                                    |
| `isAffordance(widget)`           | `true` for a widget a person or the system acts on.                                   |

```ts
import { build, diff, describeDiff } from "@jumper/lang";

const before = build({ source: oldSource });
const after = build({ source: newSource });
if (before.ok && after.ok) console.log(describeDiff(diff({ before, after })));
```

## Examples

`@jumper/lang/examples` exports the example boards that the playground uses:

```ts
import { examples } from "@jumper/lang/examples";

for (const example of examples) console.log(example.id, example.name, example.source.length);
```

## Types

The package exports these types: `Analysed`, `Analysis`, `Board`, `BoardDiff`, `BuildOptions`, `BuildResult`, `Comment`, `CompileResult`, `Diagnostic`, `DiagnosticCode`, `Edit`, `Expr`, `Fidelity`, `Fix`, `FormatResult`, `Hop`, `Incomplete`, `Place`, `PlaceKind`, `Position`, `Region`, `Related`, `Rendered`, `RenderOptions`, `Retarget`, `Scenario`, `ScenarioStep`, `Severity`, `Span`, `Step`, `StepOption`, `Story`, `StoryPath`, `Actor`, `Widget`, `WidgetType` and `Wire`.

`DiagnosticCode` is a union of every code, so a `switch` over it can be exhaustive.
