# Places

Every place has an id and a title:

```lisp
(screen :id "Title"
  …widgets, notes and questions)
```

The id comes first and is required. A place without one is the error [`missing-id`](diagnostics.md#missing-id). Two places with the same id is the error [`duplicate-id`](diagnostics.md#duplicate-id).

| Form                           | Drawn as             | Holds                                   |
| ------------------------------ | -------------------- | --------------------------------------- |
| `(screen :id "Title" …)`       | A wireframe screen   | Widgets, notes, questions               |
| `(place :id "Title" …)`        | The same as `screen` | The same as `screen`                    |
| `(slot :id "Title" …)`         | A dotted screen      | Widgets, notes, questions               |
| `(system :id "Title" …)`       | A dashed box         | `(out …)`, `(text …)`, notes, questions |
| `(decision :id "Question?" …)` | A green diamond      | `(to …)`, notes, questions              |

A widget that a place cannot hold is the error [`widget-not-allowed`](diagnostics.md#widget-not-allowed).

## Screen

A screen is a page or dialog that the user sees. It holds any widget except `(out …)` and `(to …)`.

```jumper
(board "Screen"
  (screen :profile "Profile"
    (title "Your profile")
    (field "Display name")
    (check "Show my email")
    (primary "Save")))
```

## Place

`place` is another name for `screen`. Use it when you prefer the breadboard word, where every location is a "place". Jumper draws and checks a `place` in the same way as a `screen`.

## Slot

A slot is UI that is not designed yet. Use it when the board needs the place in the flow, but the design leaves its contents open.

```jumper
(board "Slot"
  (screen :dashboard "Dashboard"
    (button "Reports" -> :reports))
  (slot :reports "Reports"
    (text "Charts to be decided")))
```

There is also a `(slot "label")` widget for a gap inside a screen. See [Widgets](widgets.md#slot).

## System

A system is code that the flow depends on but the user does not see: a payment call, a background job, an email. Each `(out …)` is one outcome, wired to the place that comes next.

```jumper
(board "System"
  (screen :checkout "Checkout"
    (primary "Pay" -> :charge))
  (system :charge "Charge card"
    (text "Calls the payment provider")
    (out "paid" -> :receipt)
    (out "declined" -> :checkout))
  (screen :receipt "Receipt"
    (title "Thank you")))
```

A system with no `(out …)` is the gap [`system-without-outcome`](diagnostics.md#system-without-outcome), because the flow stops inside it.

## Decision

A decision is a branch point. Its title is the question. Each `(to :id "condition")` is one branch.

```jumper
(board "Decision"
  (screen :sign-in "Sign in"
    (primary "Sign in" -> :known))
  (decision :known "Is the password right?"
    (to :home "yes")
    (to :sign-in "no"))
  (screen :home "Home"
    (title "Welcome back")))
```

A decision with fewer than two branches is the gap [`decision-without-branches`](diagnostics.md#decision-without-branches).

### System or decision?

Use a **system** when code does work and reports an outcome, such as "charge the card". Use a **decision** when the flow only asks a question of data it already has, such as "is the user signed in?". Both draw their branches as wires, and stories treat both as steps that the system takes.
