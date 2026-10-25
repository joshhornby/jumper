# Wires

A wire joins an affordance to a place. It shows where the flow goes when someone uses the affordance, or when a system or decision takes a branch.

## Write a wire

Add `->` and a place id at the end of a widget:

```lisp
(button "Submit" -> :save-card)
```

The wire leaves the place at the height of its widget and arrives at the target place.

## Label a wire

A string after the id labels the wire. Jumper draws the label on the wire:

```lisp
(slot "Autopay on" -> :charge "on due date")
(out "paid" -> :confirm "receipt")
```

Use a label to say _when_ or _why_ the flow moves, where the affordance text alone does not say it.

## Branches

A system's `(out …)` and a decision's `(to …)` are wires too:

```lisp
(out "declined" -> :setup)
(to :expired "expired")
```

For `out`, the affordance is the label before the arrow. For `to`, the affordance is the condition.

## Wire keys

Every wire has a stable **key**: the source place id and the affordance text, such as `:invoice "Turn on Autopay"`. When one place has two wires with the same affordance text, the second key gets a suffix, such as `:invoice "Pay" #2`.

The key does not change when you move or add other widgets. [`jumper diff`](cli.md#diff) uses keys to match wires between two versions of a board, and [scenarios](testing.md) use them to name each action.

## Example

```jumper
(board "Autopay"
  (screen :invoice "Invoice"
    (button "Turn on Autopay" -> :setup)
    (slot "Autopay on" -> :charge "on due date"))
  (screen :setup "Setup Autopay"
    (primary "Submit" -> :save-card))
  (system :save-card "Save card"
    (out "valid" -> :confirm)
    (out "declined" -> :setup))
  (system :charge "Charge card"
    (out "paid" -> :confirm "receipt"))
  (screen :confirm "Confirmation"
    (link "Back to invoice" -> :invoice)))
```

## Gaps about wires

| Gap                                                           | Cause                                                                                                             |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [`unknown-target`](diagnostics.md#unknown-target)             | The wire points at an id that no place has.                                                                       |
| [`duplicate-affordance`](diagnostics.md#duplicate-affordance) | Two wires on one place have the same text but lead to different places, so a story cannot say which one it means. |
| [`unreachable`](diagnostics.md#unreachable)                   | No entry point leads to a place.                                                                                  |

A wire back to an earlier place is fine. A "card declined" wire back to the form is a real loop, not a gap.
