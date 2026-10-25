# Formatting

`jumper fmt` prints a file in one canonical layout. The same board always prints the same way, so two versions diff cleanly and nobody argues about style.

```sh
jumper fmt board.jumper          # print the formatted file
jumper fmt board.jumper --write  # format the file in place
jumper fmt board.jumper --check  # exit with 1 if the file is not formatted
```

The playground formats the source with **Format** or Shift+Alt+F.

## The rules

1. A form that holds only text, ids and arrows stays on one line, such as `(button "Submit" -> :save-card)`.
2. A form that holds other forms puts its name, id and title on the first line. Each child goes on its own line, indented by two spaces.
3. One blank line separates the board and each story.
4. A comment stays above the code it comes before. A comment at the end of a line stays at the end of that line.
5. The file ends with one line break.

## Example

```jumper fmt source
; Messy but valid.
(board "Sign up" (screen :form "Sign up" (field "Email")
      (primary "Create account" -> :welcome)) ; The only form.
  (screen :welcome "Welcome" (title "You are in")))
(story "Signs up" (step :form "Enters an email") (step :welcome "Is in"))
```

## What stops the formatter

Only a syntax error, such as a missing parenthesis, stops the formatter, because Jumper cannot read the structure. A board with other errors, such as an unknown widget, or with gaps still formats.

## Use it in CI

Run `jumper fmt --check` on every `.jumper` file in a pull request. See [Review and CI](ci.md).
