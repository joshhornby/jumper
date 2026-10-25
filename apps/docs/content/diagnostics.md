# Diagnostic reference

This page lists every diagnostic code. Each code has one severity, so a tool can match on the code and never on the message. The message text can change between versions. The code does not.

Each example below is real. The output under it is what `jumper check` prints for that source.

## Summary

| Code                                                      | Severity | Cause                                                                   |
| --------------------------------------------------------- | -------- | ----------------------------------------------------------------------- |
| [`unclosed-string`](#unclosed-string)                     | error    | A string has no closing quote.                                          |
| [`unclosed-list`](#unclosed-list)                         | error    | A list has no closing parenthesis.                                      |
| [`unmatched-paren`](#unmatched-paren)                     | error    | A closing parenthesis has no opening one.                               |
| [`expected-form`](#expected-form)                         | error    | A value stands where a `(form …)` must be.                              |
| [`expected-string`](#expected-string)                     | error    | A title is not a string.                                                |
| [`not-a-string`](#not-a-string)                           | error    | A widget takes only strings, and got something else.                    |
| [`arrow-needs-space`](#arrow-needs-space)                 | error    | `->` touches the id after it.                                           |
| [`argument-count`](#argument-count)                       | error    | A widget has too many or too few strings.                               |
| [`expected-target`](#expected-target)                     | error    | `->` is not followed by a `:place-id`.                                  |
| [`missing-target`](#missing-target)                       | error    | An `out` has no wire, or a `to` is written the wrong way round.         |
| [`missing-condition`](#missing-condition)                 | error    | A `to` has no condition.                                                |
| [`bad-wire-label`](#bad-wire-label)                       | error    | A wire label is not a string.                                           |
| [`unexpected-value`](#unexpected-value)                   | error    | A value follows a complete wire.                                        |
| [`missing-widget-name`](#missing-widget-name)             | error    | A form inside a place has no name.                                      |
| [`unknown-widget`](#unknown-widget)                       | error    | A place holds a form that is not a widget.                              |
| [`widget-not-allowed`](#widget-not-allowed)               | error    | A widget is in the wrong kind of place.                                 |
| [`bad-columns`](#bad-columns)                             | error    | `columns` holds a form that is not `col`.                               |
| [`missing-id`](#missing-id)                               | error    | A place or step has no id.                                              |
| [`duplicate-id`](#duplicate-id)                           | error    | Two places have the same id.                                            |
| [`unknown-form`](#unknown-form)                           | error    | A form is not allowed where it stands.                                  |
| [`duplicate-board`](#duplicate-board)                     | error    | A file holds two boards.                                                |
| [`missing-board`](#missing-board)                         | error    | A file holds no board.                                                  |
| [`story-holds-steps`](#story-holds-steps)                 | error    | A story holds a form that is not `step`.                                |
| [`bad-step-option`](#bad-step-option)                     | error    | A step has an option that is not `:via` or `:touch`.                    |
| [`missing-option-value`](#missing-option-value)           | error    | `:via` or `:touch` has no string.                                       |
| [`duplicate-option`](#duplicate-option)                   | error    | A step gives `:via` or `:touch` twice.                                  |
| [`unknown-target`](#unknown-target)                       | gap      | A wire points at an id that no place has.                               |
| [`unreachable`](#unreachable)                             | gap      | No entry point leads to a place.                                        |
| [`unknown-step-place`](#unknown-step-place)               | gap      | A step is on a place that does not exist.                               |
| [`unknown-touch`](#unknown-touch)                         | gap      | `:touch` names a widget the place does not have.                        |
| [`unknown-via`](#unknown-via)                             | gap      | `:via` names an affordance the place does not have.                     |
| [`via-leads-elsewhere`](#via-leads-elsewhere)             | gap      | The `:via` wire leads to a different place from the next step.          |
| [`hop-without-wire`](#hop-without-wire)                   | gap      | No wire joins two steps.                                                |
| [`ambiguous-hop`](#ambiguous-hop)                         | gap      | More than one wire joins two steps, and the step has no `:via`.         |
| [`empty-story`](#empty-story)                             | gap      | A story has no steps.                                                   |
| [`via-on-last-step`](#via-on-last-step)                   | gap      | The last step has `:via`.                                               |
| [`duplicate-affordance`](#duplicate-affordance)           | gap      | Two wires on one place have the same text and lead to different places. |
| [`system-without-outcome`](#system-without-outcome)       | gap      | A system has no `(out …)`.                                              |
| [`decision-without-branches`](#decision-without-branches) | gap      | A decision has fewer than two branches.                                 |

## Syntax errors

A syntax error stops all other checks, because Jumper cannot read the structure of the file.

### unclosed-string

A string has no closing quote. The string runs to the end of the file.

**Fix:** add the closing `"`.

```jumper check
(board "Help)
```

### unclosed-list

A list has no closing parenthesis. When the indentation shows where the list most likely ends, Jumper points there.

**Fix:** add the missing `)`.

```jumper check
(board "Help"
  (screen :home "Home"
    (link "Help" -> :help)
  (screen :help "Help"
    (title "How can we help?")))
```

### unmatched-paren

A closing parenthesis has no matching opening parenthesis.

**Fix:** remove the extra `)`.

```jumper check
(board "Help"
  (screen :home "Home"))
  (title "Hello"))
```

## Form errors

### expected-form

A string, id or word stands where a `(form …)` must be, such as directly inside the board.

**Fix:** wrap the value in the form it belongs to, or remove it.

```jumper check
(board "Help"
  "Home"
  (screen :home "Home"))
```

### expected-string

A board, region, place or story title is not a string.

**Fix:** write the title in double quotes.

```jumper check
(board Help
  (screen :home "Home"))
```

### not-a-string

A widget takes only strings before its wire, and got an id or a word.

**Fix:** write the text in double quotes.

```jumper check
(board "Help"
  (screen :home "Home"
    (button :save)))
```

### arrow-needs-space

`->` touches the id after it, so Jumper reads one word, `->:next`.

**Fix:** put a space after `->`. Jumper offers this edit.

```jumper check
(board "Help"
  (screen :home "Home"
    (button "Go" ->:next))
  (screen :next "Next"))
```

### argument-count

A widget has the wrong number of strings. Most widgets take exactly one. `post` takes one or two. `list` and `col` take at least one. `divider` takes none.

**Fix:** use one widget for each label.

```jumper check
(board "Help"
  (screen :home "Home"
    (button "Save" "Cancel")))
```

### expected-target

`->` is not followed by a `:place-id`.

**Fix:** write the id with a colon. When the target is a word, Jumper offers this edit.

```jumper check
(board "Help"
  (screen :home "Home"
    (button "Go" -> next))
  (screen :next "Next"))
```

### missing-target

An `(out …)` has no wire, or a `(to …)` has the condition before the id.

**Fix:** write `(out "label" -> :id)` and `(to :id "condition")`. For a swapped `to`, Jumper offers an edit that puts the id first.

```jumper check
(board "Help"
  (screen :home "Home"
    (primary "Save" -> :save))
  (system :save "Save"
    (out "done")))
```

### missing-condition

A `(to :id)` has no condition string.

**Fix:** add the condition, such as `(to :home "yes")`.

```jumper check
(board "Help"
  (decision :signed-in "Signed in?"
    (to :home)
    (to :login "no"))
  (screen :home "Home")
  (screen :login "Sign in"))
```

### bad-wire-label

The value after a wire's id is not a string.

**Fix:** write the label in double quotes.

```jumper check
(board "Help"
  (screen :home "Home"
    (button "Go" -> :next :soon))
  (screen :next "Next"))
```

### unexpected-value

A value follows a complete wire. A wire is `-> :id` and an optional label, and nothing more.

**Fix:** remove the extra value.

```jumper check
(board "Help"
  (screen :home "Home"
    (button "Go" -> :next "now" "later"))
  (screen :next "Next"))
```

### missing-widget-name

A form inside a place starts with a string, not a name.

**Fix:** add the widget name, such as `(button "Save")`.

```jumper check
(board "Help"
  (screen :home "Home"
    ("Save")))
```

### unknown-widget

A place holds a form that is not a widget. When the name is close to a widget name, Jumper offers the correct spelling.

**Fix:** use a name from [Widgets](widgets.md).

```jumper check
(board "Help"
  (screen :home "Home"
    (buton "Save")))
```

### widget-not-allowed

A widget is in a kind of place that cannot hold it. A system holds only `out` and `text`. A decision holds only `to`. A screen or slot cannot hold `out` or `to`.

**Fix:** move the widget to the right kind of place. On a screen, wire a button or link instead.

```jumper check
(board "Help"
  (screen :home "Home"
    (out "done" -> :next))
  (screen :next "Next"))
```

### bad-columns

`(columns …)` holds a form that is not `(col …)`.

**Fix:** write each column as `(col "Title" "card" …)`.

```jumper check
(board "Help"
  (screen :home "Home"
    (columns
      (row "Open" "Task"))))
```

### missing-id

A place or a step has no id first.

**Fix:** add an id, such as `(screen :home "Home")`.

```jumper check
(board "Help"
  (screen "Home"))
```

### duplicate-id

Two places have the same id. The diagnostic points at the first use too.

**Fix:** give one of the places a new id.

```jumper check
(board "Help"
  (screen :home "Home")
  (screen :home "Home again"))
```

### unknown-form

A form is not allowed where it stands. The top level holds only `board` and `story`. A board holds only `region` and places. A region holds only places. When the name is close to an allowed one, Jumper offers the correct spelling.

**Fix:** use an allowed form, or move a `story` out of the board.

```jumper check
(board "Help"
  (scren :home "Home"))
```

### duplicate-board

A file holds more than one board.

**Fix:** move the second board to its own file.

```jumper check
(board "First"
  (screen :home "Home"))

(board "Second"
  (screen :other "Other"))
```

### missing-board

A file holds no board, so Jumper has nothing to draw.

**Fix:** add a `(board "Title" …)` form.

```jumper check
(story "Lost"
  (step :home "Arrives"))
```

## Story errors

### story-holds-steps

A story holds a form that is not `(step …)`.

**Fix:** write each step as `(step :id "Caption")`.

```jumper check
(board "Help"
  (screen :home "Home"))

(story "Visit"
  (stop :home "Arrives"))
```

### bad-step-option

A step has an option that is not `:via` or `:touch`, or a value where an option must be. When the option is close to one of the two, Jumper offers the correct spelling.

**Fix:** use `:via "Affordance"` or `:touch "Widget"`, after the caption.

```jumper check
(board "Help"
  (screen :home "Home"
    (button "Go" -> :next))
  (screen :next "Next"))

(story "Visit"
  (step :home "Arrives" :vai "Go")
  (step :next "Moves on"))
```

### missing-option-value

`:via` or `:touch` has no string after it.

**Fix:** add the text, such as `:touch "Email"`.

```jumper check
(board "Help"
  (screen :home "Home"
    (field "Email")))

(story "Visit"
  (step :home "Arrives" :touch))
```

### duplicate-option

A step gives `:via` or `:touch` twice.

**Fix:** keep one. A step moves through one wire and highlights one widget.

```jumper check
(board "Help"
  (screen :home "Home"
    (button "Go" -> :next)
    (link "Skip" -> :next))
  (screen :next "Next"))

(story "Visit"
  (step :home "Arrives" :via "Go" :via "Skip")
  (step :next "Moves on"))
```

## Board gaps

### unknown-target

A wire points at an id that no place has. When the id is close to a real one, Jumper offers the correct spelling.

**Fix:** correct the id, or add the missing place.

```jumper check
(board "Shop"
  (screen :payment "Payment"
    (primary "Pay" -> :recipt))
  (screen :receipt "Receipt"
    (title "Thank you")))
```

### unreachable

No entry point leads to a place. Every place with no incoming wire is an entry point, so only a loop with no way in, and the places it leads to, are unreachable.

**Fix:** wire an affordance to one place in the loop, or remove the places.

```jumper check
(board "Shop"
  (screen :home "Home"
    (title "Welcome"))
  (screen :help "Help"
    (link "Contact us" -> :contact))
  (screen :contact "Contact"
    (link "Help" -> :help)))
```

### duplicate-affordance

Two wires on one place have the same text but lead to different places. A story cannot say which one it means.

**Fix:** rename one affordance.

```jumper check
(board "Shop"
  (screen :home "Home"
    (button "Next" -> :a)
    (link "Next" -> :b))
  (screen :a "A")
  (screen :b "B"))
```

### system-without-outcome

A system has no `(out …)`, so the flow stops inside it.

**Fix:** add an outcome for each result, such as `(out "done" -> :next)`.

```jumper check
(board "Shop"
  (screen :cart "Cart"
    (primary "Pay" -> :charge))
  (system :charge "Charge card"
    (text "Calls the payment provider")))
```

### decision-without-branches

A decision has fewer than two `(to …)` branches. A question with one answer is not a decision.

**Fix:** add the other branch, or replace the decision with a wire.

```jumper check
(board "Shop"
  (screen :cart "Cart"
    (primary "Check out" -> :signed-in))
  (decision :signed-in "Signed in?"
    (to :pay "yes"))
  (screen :pay "Pay"))
```

## Story gaps

### unknown-step-place

A step is on a place that does not exist. When the id is close to a real one, Jumper offers the correct spelling.

**Fix:** correct the id, or add the place.

```jumper check
(board "Shop"
  (screen :cart "Cart"
    (primary "Pay" -> :receipt))
  (screen :receipt "Receipt"))

(story "Buys"
  (step :cart "Pays")
  (step :reciept "Sees the receipt"))
```

### unknown-touch

`:touch` names a widget that the place does not have. When the text is close, Jumper offers the exact text.

**Fix:** use the widget's exact text.

```jumper check
(board "Shop"
  (screen :cart "Cart"
    (field "Voucher code")))

(story "Uses a voucher"
  (step :cart "Types the code" :touch "Voucher Code"))
```

### unknown-via

`:via` names an affordance that the step's place does not have, or has without a wire. Jumper offers the closest wired text, or the one wire that leads to the next step.

**Fix:** use the exact text of a wired affordance or wire label.

```jumper check
(board "Shop"
  (screen :cart "Cart"
    (primary "Check out" -> :pay))
  (screen :pay "Pay"))

(story "Buys"
  (step :cart "Checks out" :via "Checkout")
  (step :pay "Pays"))
```

### via-leads-elsewhere

The `:via` wire exists, but it leads to a different place from the next step. The diagnostic points at the wire it found. When exactly one wire leads to the next step, Jumper offers it.

**Fix:** name the right wire, or fix the next step.

```jumper check
(board "Shop"
  (screen :cart "Cart"
    (primary "Check out" -> :pay)
    (link "Keep shopping" -> :home))
  (screen :pay "Pay")
  (screen :home "Home"))

(story "Buys"
  (step :cart "Checks out" :via "Keep shopping")
  (step :pay "Pays"))
```

### hop-without-wire

No wire leads from one step's place to the next step's place. The story describes a move the board cannot make.

**Fix:** wire an affordance between the two places, or fix the story.

```jumper check
(board "Shop"
  (screen :cart "Cart"
    (title "Your cart"))
  (screen :pay "Pay"))

(story "Buys"
  (step :cart "Looks at the cart")
  (step :pay "Pays"))
```

### ambiguous-hop

More than one wire leads from one step's place to the next, and the step has no `:via`. Jumper cannot infer which wire the story means.

**Fix:** add `:via` with one of the wires that the message lists.

```jumper check
(board "Shop"
  (screen :cart "Cart"
    (primary "Check out" -> :pay)
    (link "Pay now" -> :pay))
  (screen :pay "Pay"))

(story "Buys"
  (step :cart "Checks out")
  (step :pay "Pays"))
```

### empty-story

A story has no steps.

**Fix:** add steps, or remove the story.

```jumper check
(board "Shop"
  (screen :cart "Cart"))

(story "To do")
```

### via-on-last-step

The last step of a story has `:via`. No step follows it, so `:via` means nothing there.

**Fix:** remove `:via` from the last step. Jumper offers this edit. To continue the story, add the next step.

```jumper check
(board "Shop"
  (screen :cart "Cart"
    (primary "Check out" -> :pay))
  (screen :pay "Pay"))

(story "Buys"
  (step :cart "Checks out" :via "Check out"))
```
