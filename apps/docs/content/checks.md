# Errors and gaps

Jumper reports two kinds of problem. Both have a code, a message, a place in the source and, often, a fix.

| Severity  | Meaning                                                                                        | Drawing                                         |
| --------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **Error** | The source is malformed, such as a missing parenthesis or an unknown widget.                   | Jumper does not draw the board.                 |
| **Gap**   | The source is valid, but the design has a hole, such as a wire to a place that does not exist. | Jumper draws the board and marks the gap on it. |

`jumper check` exits with 1 when the board has any error or gap, and with 0 when it has none.

## Errors

An error stops the drawing. Jumper still checks the rest of the board, so you see its gaps together with the errors. It does not report a gap about a place or story that lost content to an error, because that gap would only repeat the error.

A syntax error, such as a missing parenthesis or an unclosed string, stops the checks too. Jumper cannot read the structure of the file until you fix it.

When a parenthesis is missing, Jumper uses the indentation to guess where the list should close:

```jumper check
(board "Help"
  (screen :home "Home"
    (link "Help" -> :help)
  (screen :help "Help"
    (title "How can we help?")))
```

## Gaps

A gap is a hole in the design. These are the gaps Jumper finds:

- A wire points at an id that no place has.
- A system has no `(out …)`, so the flow stops inside it.
- A decision has fewer than two `(to …)` branches.
- Two wires on one place have the same name but lead to different places. A story cannot say which one it means.
- A group of places is unreachable. Every place with no incoming wire counts as an entry point, so only a loop with no way in, and the places it leads to, are gaps.
- A story step is on a place that does not exist.
- A story hop has no wire behind it, or its `:via` leads somewhere else.
- More than one wire joins two steps, and the step has no `:via`.
- `:touch` names a widget that the place does not have.
- A story has no steps.
- The last step of a story has `:via`.

```jumper check
(board "Checkout"
  (screen :cart "Cart"
    (list "Mug" "Tea towel")
    (primary "Checkout" -> :payment))
  (screen :payment "Payment"
    (field "Card")
    (primary "Pay" -> :receipt)))

(story "Buys a mug"
  (step :cart "Adds a mug" :via "Checkout")
  (step :payment "Pays" :via "Pay")
  (step :receipt "Sees the receipt"))
```

The [Diagnostic reference](diagnostics.md) lists every code with an example.

## What Jumper does not report

Some things look like problems but are normal in a real flow:

- **A screen with no way out.** A confirmation screen is a real end.
- **A loop that a story can enter.** A "card declined" wire back to the form is a real loop.
- **A place with no wire in.** It is an entry point. A board can have many, such as a sign-in screen and an email link.

## Fixes

Many diagnostics come with a fix. A fix always has a message, such as `Did you mean :receipt?`. It has an **edit** only when the change is safe to apply without a person checking it, such as the correct spelling of an id.

- `jumper check` prints the fix and the line as it reads after the fix.
- The playground offers the fix as a one-click action in the editor.
- `jumper check --json` includes the edit, so a tool or an agent can apply it. See [JSON output](json.md#fix).

## Related source

Some diagnostics point at a second place in the source. A duplicate id points at the first use of the id. A `:via` that leads elsewhere points at the wire it found. `jumper check` prints the related source under the message.

```jumper check
(board "Twice"
  (screen :home "Home"
    (button "Go" -> :home))
  (screen :home "Home again"
    (title "Hello")))
```
