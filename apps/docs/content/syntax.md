# Syntax

Jumper source is a list of S-expressions. This page gives the rules that every Jumper file follows. The pages after it describe each form.

## Files

A Jumper file has the extension `.jumper` and is UTF-8 text. It holds:

- exactly one `(board …)` form,
- any number of `(story …)` forms, after or before the board.

```jumper
; A board and one story.
(board "Help"
  (screen :home "Home"
    (link "Help" -> :help))
  (screen :help "Help"
    (title "How can we help?")))

(story "Finds help"
  (step :home "Looks for help")
  (step :help "Reads the help page"))
```

## Forms

A **form** is a list in parentheses. The first item is the form's name. The other items are its arguments:

```lisp
(button "Save" -> :saved)
```

Here `button` is the name, `"Save"` is a string, `->` is the arrow and `:saved` is an id. A form can hold other forms. Indentation and line breaks do not change the meaning, but [`jumper fmt`](formatting.md) prints one standard layout.

## Strings

A string is text in double quotes. Titles, labels, captions and widget text are strings.

| Write | To get         |
| ----- | -------------- |
| `\"`  | A double quote |
| `\\`  | A backslash    |
| `\n`  | A line break   |

```lisp
(text "She said \"hello\"")
```

A string can hold any character, such as `£` or `→`.

## Ids

An id starts with a colon, such as `:invoice` or `:save-card`. It names a place. Each place id must be unique on the board.

An id runs until a space, a parenthesis, a double quote or a semicolon. Use lower-case words joined with hyphens. `:via` and `:touch` look like ids, but they are [step options](stories.md#step-options).

## Arrows

`->` starts a wire. Put a space on each side of it:

```lisp
(button "Next" -> :details)
```

`->:details` is an error with the code [`arrow-needs-space`](diagnostics.md#arrow-needs-space). A string after the id labels the wire:

```lisp
(slot "Autopay on" -> :charge "on due date")
```

## Comments

A comment starts with `;` and runs to the end of the line. Jumper ignores comments, and `jumper fmt` keeps them:

```lisp
; This region answers the main question.
(screen :invoice "Invoice" ; The page the client opens.
  (text "Amount due"))
```

## The forms at a glance

| Form                                                                            | Where                        | Page                                      |
| ------------------------------------------------------------------------------- | ---------------------------- | ----------------------------------------- |
| `(board "Title" …)`                                                             | Top level, once              | [Boards and regions](boards.md)           |
| `(region "Title" "Question?" …)`                                                | Inside the board             | [Boards and regions](boards.md#regions)   |
| `(screen :id "Title" …)`, `(place …)`, `(slot …)`, `(system …)`, `(decision …)` | Inside the board or a region | [Places](places.md)                       |
| `(title …)`, `(field …)`, `(button …)` and the other widgets                    | Inside a place               | [Widgets](widgets.md)                     |
| `(note "…")`, `(question "…")`                                                  | Inside a place               | [Widgets](widgets.md#notes-and-questions) |
| `(story "Title" …)`                                                             | Top level                    | [Stories](stories.md)                     |
| `(step :id "Caption" …)`                                                        | Inside a story               | [Stories](stories.md#steps)               |

## Names are exact

Form names, ids and text are case-sensitive. `(Button "Save")` is an unknown widget, and `:Invoice` is a different id from `:invoice`. When a name is close to a known one, Jumper suggests it:

```jumper check
(board "Typo"
  (screen :home "Home"
    (buton "Save")))
```
