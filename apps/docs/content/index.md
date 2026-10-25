# Introduction

Jumper is a small language for user flows: the screens a person sees, what they can do on each one, and where each action leads. You write the flow as text. Jumper draws it as wireframes, and checks that every story you tell about it follows a real path.

Jumper grew out of _breadboarding_ from Basecamp's [Shape Up](https://basecamp.com/shapeup), where a flow is sketched as places, affordances and the connections between them. You do not need to use Shape Up to use Jumper. It works for any wireframe, product spec or design review.

```jumper
(board "Invoice autopay"
  (region "Turn it on" "Can a client switch on autopay from the invoice?"
    (screen :invoice "Invoice"
      (text "Amount due £480")
      (button "Turn on Autopay" -> :setup))
    (screen :setup "Setup Autopay"
      (field "Card number")
      (primary "Submit" -> :save-card))
    (system :save-card "Save card"
      (out "valid" -> :confirm)
      (out "declined" -> :setup))
    (screen :confirm "Confirmation"
      (title "Autopay is on"))))

(story "Client turns on autopay"
  (step :invoice "Opens the invoice" :via "Turn on Autopay")
  (step :setup "Enters the card once" :touch "Card number")
  (step :save-card "Card is verified" :via "valid")
  (step :confirm "Future invoices pay themselves"))
```

## Why a language for flows

A Jumper board shows places, the affordances on each place, and the wires between them. It leaves out visual design on purpose, so a team can agree on the flow before anyone draws pixels.

A drawing tool cannot tell you that a flow is broken. Jumper can, because the board is data:

- A button that leads to a screen nobody has drawn is a **gap**.
- A system that never says what happens next is a **gap**.
- A story that jumps between two places with no wire between them is a **gap**.

Jumper marks each gap on the drawing and lists it with the source line and a suggested fix. See [Errors and gaps](checks.md).

## What you get

| Tool                                   | What it does                                                                     |
| -------------------------------------- | -------------------------------------------------------------------------------- |
| [Playground](playground-guide.md)      | Edit a board in the browser. The board, stories and problems update as you type. |
| [`jumper check`](cli.md#check)         | Report errors and gaps, as text for people or as JSON for tools.                 |
| [`jumper build`](cli.md#build)         | Draw the board or one story as SVG.                                              |
| [`jumper fmt`](cli.md#fmt)             | Print the board in one canonical layout.                                         |
| [`jumper diff`](cli.md#diff)           | Compare two versions of a board by meaning, and list the stories to read again.  |
| [`jumper scenarios`](cli.md#scenarios) | Turn each story into a test scenario as JSON.                                    |
| [`@jumper/lang`](api.md)               | All of the above as a TypeScript library.                                        |

## Who it is for

- **Product managers and designers** write boards to agree the flow of a feature before anyone builds it.
- **Teams who build** read the board and the stories as the contract for the interface.
- **Agents** write and change boards, then use `jumper check --json` to find and fix gaps. See [Using Jumper with agents](agents.md).

## Read these docs as Markdown

Every page is also available as Markdown. Add `.md` to the page name, or use **View as Markdown** at the top of the page. [llms.txt](llms.txt) lists every page for agents, and [llms-full.txt](llms-full.txt) holds all pages in one file.

## Next steps

- [Getting started](getting-started.md): install Jumper and write a first board.
- [Core concepts](concepts.md): the words these docs use.
- [Examples](examples.md): complete boards to copy.
