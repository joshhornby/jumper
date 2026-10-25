# Designing a flow

This guide shows one way to go from a feature idea to a board and stories that a team can build from. It works for a product spec, a design review or a quick wireframe to settle an argument.

## 1. Start with the questions

Before you draw anything, write down the questions the design must answer. Each question becomes a region.

> Can a client switch on autopay from the invoice they are paying?
>
> What does the client see once it is on?

A question keeps a region small. If you cannot say what question a group of places answers, it is not a region yet.

## 2. Add the places, not the pixels

Add the fewest places that answer each question. For each place, add only the affordances that move the flow and the text that a reader needs. Leave out layout and visual detail. You can draw those later, once the flow is agreed.

```lisp
(screen :invoice "Invoice"
  (text "Amount due £480")
  (button "Turn on Autopay" -> :setup))
```

When you know a screen is needed but not what is on it, use a [`slot`](places.md#slot). The board stays honest about what is decided.

## 3. Make the invisible steps visible

Most flows depend on work the user never sees: a card check, an email, a background job. Draw each one as a [`system`](places.md#system) with an `(out …)` for every outcome. Jumper reports a system with no outcome, so you cannot forget to say what happens next.

Draw a branch on data that the flow already has as a [`decision`](places.md#decision).

## 4. Tell the stories

Write a story for the main path. Then write one for each branch that matters: the declined card, the expired link, the request that is already full.

```lisp
(story "Card is declined"
  (step :setup "Submits a bad card")
  (step :save-card "Bank declines it" :via "declined")
  (step :setup "Sees the form again"))
```

Run `jumper check` after each story. A gap here is cheap to fix. The same gap found halfway through the build is not.

## 5. Record what is open

Use `(question …)` for anything the design has not settled, and `(note …)` for decisions a builder must not undo. Questions are red on the board, so a reviewer sees them at once.

```lisp
(question "Do we email a receipt for each automatic charge?")
(note "Same message either way, so we do not reveal which emails have accounts.")
```

## 6. Hand it over

Put the `.jumper` file in the repository next to the spec. The team gets:

- the board, as SVG from `jumper build`, for the spec and the kick-off,
- the stories, as the contract for the interface,
- [test scenarios](testing.md) from `jumper scenarios`,
- a way to see what a change to the board means, with [`jumper diff`](ci.md#review-board-changes).

## Signs that a board needs more work

| Sign                                                        | What it can mean                                                              |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| A region has more than five places.                         | It answers more than one question. Split it.                                  |
| A story needs many `:via` options to get through one place. | The place does too much.                                                      |
| Many `(question …)` forms in one region.                    | The region is not designed yet. Settle the questions before anyone builds it. |
| A place no story visits.                                    | The place is not needed, or a story is missing.                               |

## Using Jumper with Shape Up

If your team uses [Shape Up](https://basecamp.com/shapeup), a Jumper board is a breadboard for the shaping phase. The regions are the questions the shaping must settle, the board goes into the pitch, and `--breadboard` draws it in the classic breadboard style.
