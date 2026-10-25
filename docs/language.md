# Jumper language reference

Jumper is a small language for Shape Up breadboards. You write S-expressions. Jumper draws the board, then checks that every story follows a real wire.

A file holds one `(board …)` and any number of `(story …)` forms. Comments start with `;`.

## Board

```lisp
(board "Title"
  (region "Title" "Question this region answers"
    …places)
  …places outside a region)
```

Regions are numbered from 1 in source order. The question is optional. Places outside a region are drawn without a panel.

## Places

Every place has an id (a `:keyword`) and a title.

| Form | Drawn as | Holds |
| --- | --- | --- |
| `(screen :id "Title" …)` | A wireframe screen | Widgets, notes, questions |
| `(place :id "Title" …)` | Same as `screen` | Same as `screen`. Use it for the original Shape Up style. |
| `(slot :id "Title" …)` | A dotted screen: UI that is not designed yet | Widgets, notes, questions |
| `(system :id "Title" …)` | A dashed box: code the user does not see | `(out …)`, `(text …)`, notes, questions |
| `(decision :id "Question?" …)` | A green diamond | `(to …)`, notes, questions |

## Widgets

| Form | Drawn as |
| --- | --- |
| `(title "text")` | Bold heading |
| `(text "text")`, `(info "text")` | Body text |
| `(meta "text")` | Small grey text |
| `(field "label")` | Input box |
| `(button "label")` | Outlined button |
| `(primary "label")` | Green button |
| `(link "label")` | Underlined link |
| `(check "label")` | Checkbox |
| `(slot "label")` | Dotted placeholder inside a screen |
| `(image "alt text")` | Image box |
| `(post "Author" "body")` | A message with an avatar. The author is optional. |
| `(list "item" "item" …)` | Rows |
| `(columns (col "Title" "card" …) …)` | Kanban columns. `(board (col …))` inside a screen also works. |
| `(divider)` | Horizontal rule |
| `(out "label" -> :id)` | A branch out of a system place |
| `(to :id "condition")` | A branch out of a decision |
| `(note "text")` | Grey note under the place |
| `(question "text")` | Red open question under the place |

## Wires

Add `-> :id` to any widget to wire it to a place. A string after the id labels the wire.

```lisp
(button "Submit" -> :save-card)
(slot "Autopay on" -> :charge "on due date")
```

The wire leaves the screen at the height of its widget.

## Stories

```lisp
(story "Client turns on autopay"
  (step :invoice "Opens the overdue invoice" :via "Turn on Autopay")
  (step :setup "Enters the card once" :touch "Card number" :via "Submit")
  (step :save-card "Card is verified" :via "valid")
  (step :confirm "Future invoices pay themselves"))
```

- `:via` names the affordance or wire label that takes the step to the next place.
- If you leave out `:via` and exactly one wire joins the two places, Jumper infers it. The playground draws an inferred wire dashed.
- `:touch` highlights a widget on the step's place, such as the field the user fills in.

## Errors and gaps

An **error** is malformed source, such as a missing parenthesis or an unknown widget. An error stops the render. Jumper still checks the rest of the board, so you see its gaps with the errors. It does not report gaps about a place or story that lost content to an error, because those gaps would only repeat the error. A syntax error, such as a missing parenthesis, stops the checks too.

A **gap** is a hole in the shaping work. The board still draws, and the gap is marked on it:

- A wire points at an id that no place has.
- A group of places is unreachable. Every place with no incoming wire counts as an entry point, so only a loop with no way in, and the places it leads to, are gaps.
- A story step is on a place that does not exist.
- A story hop has no wire behind it, or its `:via` leads somewhere else.
- More than one wire joins two steps and the step has no `:via`.
- `:touch` names a widget that the place does not have.
- A story has no steps.
- The last step of a story has `:via`. No hop follows the last step, so `:via` means nothing there.

A step that gives `:via` or `:touch` twice is an error.
