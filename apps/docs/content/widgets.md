# Widgets

A widget is one thing on a place. Write it as a form inside the place. Most widgets can end with a [wire](wires.md). `columns` cannot carry a wire, and `to` names its target in its own way.

## Summary

| Form                                 | Arguments           | Drawn as                          | Affordance      |
| ------------------------------------ | ------------------- | --------------------------------- | --------------- |
| `(title "text")`                     | 1 string            | Bold heading                      | Only when wired |
| `(text "text")`                      | 1 string            | Body text                         | Only when wired |
| `(info "text")`                      | 1 string            | The same as `text`                | Only when wired |
| `(meta "text")`                      | 1 string            | Small grey text                   | Only when wired |
| `(field "label")`                    | 1 string            | Input box                         | Yes             |
| `(button "label")`                   | 1 string            | Outlined button                   | Yes             |
| `(primary "label")`                  | 1 string            | Green button                      | Yes             |
| `(link "label")`                     | 1 string            | Underlined link                   | Yes             |
| `(check "label")`                    | 1 string            | Checkbox                          | Yes             |
| `(slot "label")`                     | 1 string            | Dotted placeholder                | Yes             |
| `(image "alt text")`                 | 1 string            | Image box                         | Only when wired |
| `(post "Author" "body")`             | 1 or 2 strings      | Message with an avatar            | Only when wired |
| `(list "item" …)`                    | 1 or more strings   | Rows                              | Only when wired |
| `(columns (col "Title" "card" …) …)` | `col` forms         | Kanban columns                    | No              |
| `(divider)`                          | None                | Horizontal rule                   | Only when wired |
| `(out "label" -> :id)`               | 1 string and a wire | A branch out of a system          | Yes             |
| `(to :id "condition")`               | An id and 1 string  | A branch out of a decision        | Yes             |
| `(note "text")`                      | 1 string            | Grey note under the place         | No              |
| `(question "text")`                  | 1 string            | Red open question under the place | No              |

The **Affordance** column says whether the widget is something a person or the system acts on. Stories, `:via` and [test scenarios](testing.md) use affordances. A wrong number of arguments is the error [`argument-count`](diagnostics.md#argument-count).

## Text

`title`, `text`, `info` and `meta` show text on a screen. `info` is another name for `text`.

```jumper
(board "Text"
  (screen :order "Order"
    (title "Order #1042")
    (text "Two items, £36")
    (meta "Placed 3 days ago")))
```

## Inputs and actions

`field`, `button`, `primary`, `link` and `check` are the controls a person uses. Use `primary` for the main action on a screen.

```jumper
(board "Inputs"
  (screen :login "Sign in"
    (field "Email")
    (field "Password")
    (check "Keep me signed in")
    (primary "Sign in" -> :home)
    (link "Forgot password?" -> :reset))
  (screen :home "Home"
    (title "Home"))
  (screen :reset "Reset password"
    (field "Email")))
```

## Slot

`(slot "label")` marks a part of a screen that is not designed yet, such as a picker or a chart. It can carry a wire, for example to a system that runs when the slot shows.

```lisp
(slot "Skills picker")
(slot "Autopay on" -> :charge "on due date")
```

For a whole screen that is not designed yet, use the [`slot` place](places.md#slot).

## Image

```lisp
(image "Product photo")
```

The text is the alt text. Jumper draws a box with the text inside.

## Post

`(post "Author" "body")` draws a message with an avatar, as in a chat or comment thread. The author is optional: `(post "body")` draws a message with no name.

```jumper
(board "Thread"
  (screen :thread "Thread"
    (post "Coordinator" "Need two drivers from 9 am.")
    (post "I can do the morning run.")
    (field "Reply")))
```

## List

`(list "item" "item" …)` draws rows. It needs at least one item.

```lisp
(list "Mug" "Tea towel" "Apron")
```

## Columns

`(columns …)` draws kanban columns. It holds only `(col "Title" "card" …)` forms. Each `col` has a title and any number of cards. A `columns` widget cannot carry a wire.

```jumper
(board "Board"
  (screen :requests "Requests"
    (columns
      (col "Open" "Drivers for Sat" "Kitchen help")
      (col "Filled" "Stewards")
      (col "Closed"))))
```

## Divider

`(divider)` draws a horizontal rule. It takes no strings.

## Out

`(out "label" -> :id)` is one outcome of a system. It must have a wire. It is allowed only inside a `system`.

```lisp
(system :save-card "Save card"
  (out "valid" -> :confirm)
  (out "declined" -> :setup))
```

## To

`(to :id "condition")` is one branch of a decision. The id comes first, then the condition. It is allowed only inside a `decision`. Unlike other widgets, `to` does not use `->`.

```lisp
(decision :known "Is the email on an account?"
  (to :send "yes")
  (to :sent "no"))
```

`(to "yes" -> :send)` is the error [`missing-target`](diagnostics.md#missing-target), and Jumper offers a fix that puts the id first.

## Notes and questions

`note` and `question` are not widgets on the screen. Jumper draws them under the place:

- `(note "text")` records a decision or a detail, in grey.
- `(question "text")` records an open question, in red, so nobody misses it.

```jumper
(board "Notes"
  (screen :sent "Check your email"
    (text "If the address has an account, a link is on its way.")
    (note "Same message either way, so we do not reveal which emails have accounts.")
    (question "Should we rate-limit new links per hour?")))
```

The playground's **Notes** switch and the CLI's `--no-notes` option hide both.
