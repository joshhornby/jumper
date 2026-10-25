# Using Jumper with agents

Jumper suits coding agents well. The source is plain text, every problem has a stable code and an exact span, and many problems come with a safe edit. An agent can write a board, check it, fix it and prove its stories without a person in the loop.

## Give the agent the docs

These docs are available as Markdown for agents:

| URL                                                                  | Contents                                                                                    |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [`llms.txt`](https://joshhornby.github.io/jumper/llms.txt)           | An index of every page, with a one-line description of each.                                |
| [`llms-full.txt`](https://joshhornby.github.io/jumper/llms-full.txt) | Every page in one file.                                                                     |
| `<page>.md`                                                          | One page as Markdown, such as [`syntax.md`](https://joshhornby.github.io/jumper/syntax.md). |

In the Markdown, every generated output is written out in full. For example, each example in the [Diagnostic reference](diagnostics.md) is followed by the exact text that `jumper check` prints for it. The **Copy as Markdown** button at the top of each page copies the same text.

For most tasks, [Syntax](syntax.md), [Widgets](widgets.md), [Stories](stories.md) and the [Diagnostic reference](diagnostics.md) are enough.

## The loop

1. **Write** the board and its stories in a `.jumper` file.
2. **Check** it with `jumper check board.jumper --json`.
3. **Fix** each diagnostic. Apply `fix.edit` when it is present. Otherwise read `message` and `code`, and change the source.
4. **Repeat** until `check` exits with 0.
5. **Format** with `jumper fmt board.jumper --write`.

```sh
jumper check board.jumper --json
```

A diagnostic gives the agent all it needs to act:

```json
{
  "code": "unknown-via",
  "severity": "gap",
  "message": "Cart has no wired affordance \"Checkout\".",
  "span": { "start": 142, "end": 152 },
  "related": [],
  "fix": {
    "message": "Did you mean \"Check out\"?",
    "edit": { "span": { "start": 142, "end": 152 }, "text": "\"Check out\"" }
  },
  "start": { "line": 7, "column": 33 },
  "end": { "line": 7, "column": 43 }
}
```

This is the diagnostic for the [`unknown-via`](diagnostics.md#unknown-via) example.

## Rules for agents

- **Match on `code`, never on `message`.** Messages are for people and can change. Codes are stable. See the [Diagnostic reference](diagnostics.md).
- **Fix errors before gaps.** An error can hide gaps. Jumper does not report a gap about a place that lost content to an error.
- **Apply edits from the end of the file to the start**, so earlier spans stay valid. Run `check` again after a round of edits, because one fix can solve or change other diagnostics.
- **A fix with `edit: null` needs judgement.** For example, `hop-without-wire` can mean the board needs a wire or the story is wrong. Decide from the intent of the feature, not from the message alone.
- **Keep `:via` and `:touch` exact.** They must match the widget text, including capitals.
- **Read the board from the JSON.** When the board has no errors, `check --json` includes `board` and `analysis`: every place, wire, wire key and story path. See [JSON output](json.md#check-json).

## Change an existing board

1. Keep a copy of the board before the change.
2. Make the change, then run the loop above.
3. Run `jumper diff before.jumper after.jumper --json`.
4. Report `affected`: the stories that a person should read again.

`diff` compares by meaning, so the agent can show a reviewer what the change does, not only which lines moved.

## Example prompt

```text
Read https://joshhornby.github.io/jumper/llms.txt and the pages it links for syntax, widgets and stories.
Write a Jumper board for <feature> in <file>.jumper, with one region for each design question
and a story for the main path and each important branch.
Run `jumper check <file>.jumper --json` and fix every diagnostic until it exits with 0.
Then run `jumper fmt <file>.jumper --write` and show me `jumper build <file>.jumper -o <file>.svg`.
```
