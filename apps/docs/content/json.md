# JSON output

Three commands print JSON for tools, editors and agents: `check --json`, `diff --json` and `scenarios`. This page describes each shape.

The JSON is stable: the same source always gives the same JSON, with keys and arrays in a fixed order. Match on codes and keys, never on message text.

## Spans and positions

A **span** is a part of the source, as `{ "start": number, "end": number }`. The numbers are offsets from the start of the file, counted in UTF-16 code units, which is how JavaScript indexes strings. `end` is exclusive. An empty span marks a point, where an edit inserts text.

A **position** is `{ "line": number, "column": number }`. Both count from 1. `check --json` adds a position for the start and end of each diagnostic, so a tool without the source can still show where the problem is.

## check --json

For the board in the [`check` example](cli.md#check), `jumper check board.jumper --json` prints:

```json
{
  "file": "board.jumper",
  "diagnostics": [
    {
      "code": "unknown-target",
      "severity": "gap",
      "message": "\"Pay\" is wired to :recipt, but no place has that id.",
      "span": { "start": 59, "end": 66 },
      "related": [],
      "fix": {
        "message": "Did you mean :receipt?",
        "edit": { "span": { "start": 59, "end": 66 }, "text": ":receipt" }
      },
      "start": { "line": 3, "column": 23 },
      "end": { "line": 3, "column": 30 }
    }
  ],
  "board": { "title": "Shop", "regions": [], "places": [], "stories": [] },
  "analysis": { "wires": [], "danglingWires": [], "unreachable": [], "stories": [], "diagnostics": [] }
}
```

`board` and `analysis` are shortened above. They are present only when the board has no errors. A board with gaps still has them.

### Diagnostic

| Key            | Type                 | Meaning                                                         |
| -------------- | -------------------- | --------------------------------------------------------------- |
| `code`         | string               | One of the codes in the [Diagnostic reference](diagnostics.md). |
| `severity`     | `"error"` or `"gap"` | Fixed for each code.                                            |
| `message`      | string               | A sentence for a person. It can change between versions.        |
| `span`         | span                 | The source the diagnostic is about.                             |
| `related`      | array                | Other source that explains it, as `{ "span", "message" }`.      |
| `fix`          | object or `null`     | A suggested fix. See below.                                     |
| `start`, `end` | position             | The line and column of the span.                                |

### Fix

| Key       | Type             | Meaning                                                                                                                                 |
| --------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `message` | string           | What to change, for a person.                                                                                                           |
| `edit`    | object or `null` | `{ "span", "text" }`: replace the span with the text. It is present only when the change is safe to apply without a person checking it. |

To apply several edits to one file, apply them from the end of the file to the start, so earlier spans stay valid. Skip an edit that overlaps one you have applied. The library's `applyEdits` does this. See [TypeScript API](api.md).

### Board

`board` is the compiled board.

| Key       | Meaning                                                                                                                                                                            |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`   | The board title.                                                                                                                                                                   |
| `regions` | Each region: `number`, `title`, `question` (or `null`), `placeIds` and `span`. Region 0, when present, holds the places outside any region.                                        |
| `places`  | Each place: `kind` (`screen`, `slot`, `system` or `decision`), `id`, `title`, `region`, `widgets`, `notes`, `span` and `idSpan`. A `place` form has the kind `screen`.             |
| `stories` | Each story: `title`, `span` and `steps`. Each step has `place`, `caption`, `via`, `touch`, `span` and `placeSpan`.`via` and `touch` are `{ "text", "span", "removal" }` or `null`. |

Each widget has a `type`, its text fields, a `wire` and a `span`. The text fields depend on the type:

| Type                                                                                                 | Fields                                 |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `title`, `text`, `meta`, `image`, `field`, `button`, `primary`, `link`, `check`, `slot`, `out`, `to` | `text`                                 |
| `post`                                                                                               | `author` (or `null`) and `text`        |
| `list`                                                                                               | `items`                                |
| `columns`                                                                                            | `columns`, each `{ "title", "items" }` |
| `divider`                                                                                            | None                                   |

`wire` is `{ "target", "label", "span", "targetSpan" }`, or `null` when the widget has no wire. An `info` widget has the type `text`.

### Analysis

| Key             | Meaning                                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `wires`         | Every wire: `key`, `from`, `widget` (the widget's index on its place), `to`, `affordance`, `label`, `span` and `targetSpan`. |
| `danglingWires` | Indexes into `wires` for wires whose target does not exist.                                                                  |
| `unreachable`   | Ids of unreachable places, in source order.                                                                                  |
| `stories`       | For each story, its path: `hops` and `highlights`.                                                                           |
| `diagnostics`   | The gaps. These are the same as the top-level `diagnostics` when the board has no errors.                                    |

A story path has one hop for each pair of steps, so a story with `n` steps has `n - 1` hops. Each hop is one of:

```json
{ "kind": "explicit", "from": "setup", "to": "save-card", "wire": 3 }
{ "kind": "inferred", "from": "save-card", "to": "setup", "wire": 5 }
{ "kind": "missing", "from": "cart", "to": "contact" }
```

`wire` is an index into `wires`. `highlights` has one entry for each step: the index of the widget to highlight on the step's place, or `null`.

## diff --json

```sh
jumper diff before.jumper after.jumper --json
```

```json
{
  "places": { "added": [], "removed": [], "changed": ["a"] },
  "wires": {
    "added": [],
    "removed": [],
    "retargeted": [{ "key": ":a \"Go\"", "before": "b", "after": "c" }]
  },
  "stories": { "added": [], "removed": [], "changed": [] },
  "affected": []
}
```

| Key        | Meaning                                                                                                                     |
| ---------- | --------------------------------------------------------------------------------------------------------------------------- |
| `places`   | Place ids that were added, removed or changed. A change is any change except position and region number.                    |
| `wires`    | Wire keys that were added or removed, and wires that now lead to a different place.                                         |
| `stories`  | Story titles that were added, removed or had their steps changed. A repeated title gets a suffix, such as `"Checkout #2"`.  |
| `affected` | Titles of stories in the new board to read again: new, edited, passing through a changed place, or now on a different path. |

## scenarios

```sh
jumper scenarios board.jumper
```

`scenarios` prints an array with one scenario for each story:

```jumper scenarios source
(board "Sign in"
  (screen :sign-in "Sign in"
    (field "Email")
    (primary "Sign in" -> :check))
  (decision :check "Is the password right?"
    (to :home "yes")
    (to :sign-in "no"))
  (screen :home "Home"
    (title "Welcome back")))

(story "Signs in"
  (step :sign-in "Enters an email" :touch "Email")
  (step :check "Password is right" :via "yes")
  (step :home "Sees the home page"))
```

### Scenario

| Key        | Type    | Meaning                                                                                               |
| ---------- | ------- | ----------------------------------------------------------------------------------------------------- |
| `story`    | string  | The story title.                                                                                      |
| `runnable` | boolean | `false` when a place or a hop is missing, because a test would describe a move the board cannot make. |
| `steps`    | array   | One entry for each step.                                                                              |

### Scenario step

| Key       | Type             | Meaning                                                                                                                      |
| --------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `place`   | string           | The place id.                                                                                                                |
| `kind`    | string or `null` | The place kind, or `null` when the place does not exist.                                                                     |
| `title`   | string or `null` | The place title.                                                                                                             |
| `caption` | string           | The step caption.                                                                                                            |
| `touch`   | object or `null` | The widget from `:touch`: `text`, `widget` (its type) and `interactive` (whether it is an affordance).                       |
| `action`  | object or `null` | How the story moves on: `actor`, `affordance`, `wire` (its key) and `inferred`.`null` on the last step and on a missing hop. |
| `expect`  | string or `null` | The place id of the next step, or `null` on the last step.                                                                   |

`actor` is `"user"` on a screen or slot: a person uses the affordance. It is `"system"` on a system or decision: a test stubs or checks the branch, and does not click it.
