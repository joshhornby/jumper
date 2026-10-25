# Stories

A story is one path through the board, written as steps. Jumper checks that each move between steps follows a real wire. If a story describes a move the board cannot make, Jumper reports a gap.

## Write a story

```lisp
(story "Title"
  (step :place "Caption" :via "Affordance" :touch "Widget")
  …)
```

- The title is a string and is required.
- A story holds only `(step …)` forms.
- Write each story at the top level, outside the board.
- A file can hold any number of stories.

## Steps

```lisp
(step :setup "Enters the card once" :touch "Card number" :via "Submit")
```

| Part                     | Required | Meaning                                                                   |
| ------------------------ | -------- | ------------------------------------------------------------------------- |
| `:setup`                 | Yes      | The place where the step happens.                                         |
| `"Enters the card once"` | No       | The caption: what happens at this step, in a few words.                   |
| `:touch "Card number"`   | No       | A widget on this place to highlight, such as the field the user fills in. |
| `:via "Submit"`          | No       | The affordance or wire label that takes the story to the next step.       |

The caption comes straight after the id. The options come after the caption, in any order.

## Step options

### `:via`

`:via` names the wire that leads to the next step. It matches a wire on the step's place by its affordance text or by its label.

If you leave out `:via` and exactly one wire joins the two places, Jumper **infers** the wire. The playground draws an inferred wire dashed. If more than one wire joins the two places, the step needs `:via`.

The last step has no next step, so `:via` on the last step is the gap [`via-on-last-step`](diagnostics.md#via-on-last-step).

### `:touch`

`:touch` highlights a widget on the step's place. Use it to show the field the user fills in, or the item they read. It does not move the story.

### Exact text

`:via` and `:touch` must match the text exactly, including capitals. The story is a contract for the real interface, so "Submit" and "submit" are different labels. When the text is close, Jumper suggests the exact text.

A step that gives `:via` or `:touch` twice is the error [`duplicate-option`](diagnostics.md#duplicate-option).

## Example

```jumper story=1
(board "Invoice autopay"
  (screen :invoice "Invoice"
    (button "Turn on Autopay" -> :setup))
  (screen :setup "Setup Autopay"
    (field "Card number")
    (primary "Submit" -> :save-card))
  (system :save-card "Save card"
    (out "valid" -> :confirm)
    (out "declined" -> :setup))
  (screen :confirm "Confirmation"
    (title "Autopay is on")))

(story "Client turns on autopay"
  (step :invoice "Opens the invoice" :via "Turn on Autopay")
  (step :setup "Enters the card once" :touch "Card number" :via "Submit")
  (step :save-card "Card is verified" :via "valid")
  (step :confirm "Future invoices pay themselves"))

(story "Card is declined"
  (step :setup "Submits a bad card")
  (step :save-card "Bank declines it" :via "declined")
  (step :setup "Sees the form again"))
```

The drawing shows the first story. Run `jumper build board.jumper --story 2` to draw the second.

## How Jumper checks a story

For each pair of steps, Jumper looks for the wire from the first place to the second:

1. If the step has `:via`, Jumper finds the wire on the step's place with that affordance or label. The wire must lead to the next step's place.
2. If the step has no `:via`, Jumper looks at every wire from the step's place to the next step's place. Exactly one wire means Jumper infers it. None or more than one is a gap.

The gaps a story can have:

| Gap                                                         | Cause                                                                |
| ----------------------------------------------------------- | -------------------------------------------------------------------- |
| [`unknown-step-place`](diagnostics.md#unknown-step-place)   | The step is on a place that does not exist.                          |
| [`hop-without-wire`](diagnostics.md#hop-without-wire)       | No wire joins the two places.                                        |
| [`ambiguous-hop`](diagnostics.md#ambiguous-hop)             | More than one wire joins the two places, and the step has no `:via`. |
| [`unknown-via`](diagnostics.md#unknown-via)                 | The place has no wired affordance with the `:via` text.              |
| [`via-leads-elsewhere`](diagnostics.md#via-leads-elsewhere) | The `:via` wire leads to a different place from the next step.       |
| [`unknown-touch`](diagnostics.md#unknown-touch)             | The place has no widget with the `:touch` text.                      |
| [`empty-story`](diagnostics.md#empty-story)                 | The story has no steps.                                              |
| [`via-on-last-step`](diagnostics.md#via-on-last-step)       | The last step has `:via`.                                            |

## Write good stories

- Write one story for the main path, then one for each branch that matters, such as a declined card.
- Keep captions short and from the user's point of view: "Enters the card once", not "Card form submitted".
- Use `:touch` for the one widget that matters at the step.
- Add `:via` when the choice of wire is part of the story, even when Jumper could infer it. It makes the story a stronger contract.
