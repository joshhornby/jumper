# Core concepts

Jumper borrows most of its words from breadboarding, a flow-sketching technique from Basecamp's Shape Up, and adds a few of its own. This page defines each word once. The rest of the docs use the words with these meanings only.

## Board

A **board** is one feature's flow: its places and the wires between them. A file holds exactly one board. See [Boards and regions](boards.md).

## Region

A **region** groups the places that answer one design question, such as "Can a client switch on autopay from the invoice?". Regions are numbered from 1 in source order. A region is optional.

## Place

A **place** is somewhere the flow can be. Every place has an **id**, such as `:invoice`, and a title. There are four kinds of place:

| Kind     | Meaning                                                                    |
| -------- | -------------------------------------------------------------------------- |
| Screen   | A page or dialog that the user sees. `place` is another name for `screen`. |
| Slot     | UI that is not designed yet.                                               |
| System   | Code that the flow depends on but the user does not see.                   |
| Decision | A branch point with a question.                                            |

See [Places](places.md).

## Widget

A **widget** is one thing on a place: a title, a field, a button, a list. Some widgets describe what the place shows. Others are **affordances**. See [Widgets](widgets.md).

## Affordance

An **affordance** is something a person or the system acts on: a field, a button, a link, a checkbox, a slot, a system outcome or a decision branch. Any other widget with a wire is also an affordance. Stories and test scenarios work with affordances.

## Wire

A **wire** joins an affordance to a place. You write it as `-> :id` at the end of the widget. A wire can have a label, such as `"on due date"`. See [Wires](wires.md).

Every wire has a stable **key** made from its source place and its affordance text, such as `:invoice "Pay"`. The key does not change when other widgets move, so tools use it to compare two versions of a board.

## Entry point

An **entry point** is a place with no wire leading in. The flow can start there. A board can have many entry points.

## Story

A **story** is one path through the board, written as **steps**. Each step names a place and says what happens there in a short caption. See [Stories](stories.md).

## Hop

A **hop** is the move from one step to the next. A story with five steps has four hops. Jumper finds the wire behind each hop:

| Hop      | Meaning                                                                     |
| -------- | --------------------------------------------------------------------------- |
| Explicit | The step names the affordance with `:via`.                                  |
| Inferred | The step has no `:via`, and exactly one wire joins the two places.          |
| Missing  | No wire supports the hop. The story describes a move the board cannot make. |

## Diagnostic

A **diagnostic** is a problem that Jumper reports. Each diagnostic has a code, a severity, a message, a source span and, often, a fix. There are two severities:

- An **error** is malformed source. It stops the drawing.
- A **gap** is a hole in the design. The board still draws, and the gap is marked on it.

See [Errors and gaps](checks.md) and the [Diagnostic reference](diagnostics.md).

## Fidelity

**Fidelity** is how Jumper draws screens. **Wireframe** draws each widget as a simple shape. **Breadboard** draws the classic breadboard style from Shape Up: the place name, then its affordances and text as words.

## Scenario

A **scenario** is a story turned into data for a test generator: for each step, the place, who acts, the affordance and the place to expect next. See [From stories to tests](testing.md).
