# CLI reference

```text
jumper check <file.jumper> [--json]
jumper build <file.jumper> [-o out.svg] [--breadboard] [--no-notes] [--story <n>]
jumper fmt <file.jumper> [--write | --check]
jumper diff <before.jumper> <after.jumper> [--json]
jumper scenarios <file.jumper>
jumper --version
jumper --help
```

Install the CLI with `npm install --global jumper-cli`. See [Getting started](getting-started.md#install).

## Output and colour

Each command writes its result, such as SVG or JSON, to standard output. It writes diagnostics and messages to standard error. So you can pipe the result and still see the problems.

Diagnostics are in colour when standard error is a terminal. Set the `NO_COLOR` environment variable to turn colour off.

## Exit codes

| Code | Meaning                                                                                  |
| ---- | ---------------------------------------------------------------------------------------- |
| 0    | The command succeeded. For `check`, the board has no errors and no gaps.                 |
| 1    | The board has a problem that the command reports. The table for each command says which. |
| 2    | Wrong usage: an unknown command, a missing argument or a file that Jumper cannot find.   |

## check

```sh
jumper check board.jumper
jumper check board.jumper --json
```

Reports every error and gap in the file. Each diagnostic shows its code, the file, line and column, the message, the source line with the problem underlined, any related source, and the fix. The last line counts the errors and gaps.

| Option   | Effect                                                                                                |
| -------- | ----------------------------------------------------------------------------------------------------- |
| `--json` | Print one JSON object to standard output in place of the text. See [JSON output](json.md#check-json). |

| Exit code | When                       |
| --------- | -------------------------- |
| 0         | No errors and no gaps.     |
| 1         | At least one error or gap. |

```jumper check source
(board "Shop"
  (screen :cart "Cart"
    (primary "Pay" -> :recipt))
  (screen :receipt "Receipt"))
```

## build

```sh
jumper build board.jumper > board.svg
jumper build board.jumper -o board.svg
jumper build board.jumper --story 2 -o story.svg
jumper build board.jumper --breadboard --no-notes -o breadboard.svg
```

Draws the board as SVG. Gaps do not stop the drawing: Jumper marks them on the board and lists them on standard error. Errors stop the drawing.

| Option                      | Effect                                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `-o <file>`, `--out <file>` | Write the SVG to a file. Without it, the SVG goes to standard output.                                                          |
| `--breadboard`              | Draw the classic breadboard style: place names, affordances and text as words. The default is wireframes.                      |
| `--no-notes`                | Leave out `(note …)` and `(question …)` text.                                                                                  |
| `--story <n>`               | Draw story number `n` on the board. Stories are numbered from 1 in source order. A number with no story draws the board alone. |

| Exit code | When                                               |
| --------- | -------------------------------------------------- |
| 0         | The board was drawn, with or without gaps.         |
| 1         | The board has an error, so Jumper did not draw it. |

## fmt

```sh
jumper fmt board.jumper
jumper fmt board.jumper --write
jumper fmt board.jumper --check
```

Prints the file in the canonical layout. See [Formatting](formatting.md). Only a syntax error stops the formatter. A board with other errors or with gaps still formats.

| Option    | Effect                                                                         |
| --------- | ------------------------------------------------------------------------------ |
| (none)    | Print the formatted file to standard output.                                   |
| `--write` | Format the file in place. The file does not change if it is already formatted. |
| `--check` | Change nothing. Exit with 1 if the file is not formatted. Use this in CI.      |

| Exit code | When                                                              |
| --------- | ----------------------------------------------------------------- |
| 0         | The file was printed or written, or `--check` found it formatted. |
| 1         | The file has a syntax error, or `--check` found it not formatted. |

## diff

```sh
jumper diff before.jumper after.jumper
jumper diff before.jumper after.jumper --json
```

Compares two versions of a board by meaning, not by text. Moving code, changing layout or editing comments is not a change.

- Places are matched by id.
- Wires are matched by [key](wires.md#wire-keys), such as `:invoice "Pay"`.
- Stories are matched by title.

The output lists places, wires and stories that were added, removed or changed, and wires that now lead somewhere else. The last line lists the **stories to read again**: stories that are new or edited, that pass through a changed place, or that now take a different path.

```text
Places changed: :a
Wires retargeted: :a "Go" now leads to :c, not :b
```

When nothing changed, `diff` prints `No change in behaviour.`

| Option   | Effect                                                          |
| -------- | --------------------------------------------------------------- |
| `--json` | Print the change as JSON. See [JSON output](json.md#diff-json). |

| Exit code | When                                                                           |
| --------- | ------------------------------------------------------------------------------ |
| 0         | Both files compiled. This is true whether or not the board changed.            |
| 1         | One of the files has an error. A diff of a broken board would compare guesses. |

## scenarios

```sh
jumper scenarios board.jumper > scenarios.json
```

Prints each story as a test scenario in JSON: for each step, the place, who acts, the affordance and the place to expect next. See [From stories to tests](testing.md) and [JSON output](json.md#scenarios).

| Exit code | When                                                                                                           |
| --------- | -------------------------------------------------------------------------------------------------------------- |
| 0         | The scenarios were printed. Gaps are listed on standard error, and a story with a gap has `"runnable": false`. |
| 1         | The board has an error.                                                                                        |

## --version and --help

`jumper --version` (or `-v`) prints the installed version. `jumper --help` (or `-h`) prints the usage.
