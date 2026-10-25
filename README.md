# Jumper

Jumper is a small language for user flows and wireframes. It grew out of breadboarding from Basecamp's [Shape Up](https://basecamp.com/shapeup), but you do not need Shape Up to use it. You write S-expressions. Jumper draws wireframe or breadboard boards and storyboards as SVG. It also checks that every story follows a real wire.

```lisp
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

Read the documentation at **https://joshhornby.github.io/jumper/**, or try Jumper in the [playground](https://joshhornby.github.io/jumper/playground/). Agents can start from [llms.txt](https://joshhornby.github.io/jumper/llms.txt).

## Install the CLI

The CLI needs Node.js 20 or later.

```sh
npm install --global jumper-cli   # or: pnpm add -g, yarn global add, bun add -g
```

```sh
jumper check board.jumper                  # report errors and gaps, add --json for tools
jumper build board.jumper -o board.svg     # draw the board, add --story 1 to draw a story
jumper fmt board.jumper --write            # format in the canonical layout
jumper diff before.jumper after.jumper     # compare two versions by meaning
jumper scenarios board.jumper              # turn each story into a test scenario
```

See the [CLI reference](https://joshhornby.github.io/jumper/cli) for every option and exit code.

## Layout

| Path                         | Contents                                                              |
| ---------------------------- | --------------------------------------------------------------------- |
| `packages/jumper`            | The language: reader, compiler, checker, formatter and SVG renderer   |
| `packages/cli`               | The `jumper` command, published to npm as `jumper-cli`                |
| `apps/playground`            | The browser playground: editor, live board, stories and problems      |
| `apps/docs`                  | The documentation site, built with VitePress. Pages are in `content/` |
| `packages/typescript-config` | Strict TypeScript config, copied from Anvil                           |

## Develop

Install [Bun](https://bun.com), then install the dependencies:

```sh
bun install
```

```sh
bun run dev         # playground at http://localhost:3000
bun run docs        # docs at http://localhost:5173/jumper/
bun test            # all tests
bun run typecheck   # all packages
bun run check       # Biome format and lint
bun run build:site  # docs and playground for GitHub Pages, in apps/docs/dist
```

Run the CLI from source with `bun packages/cli/src/cli.ts <command>`.

## Release

Releases use [Changesets](https://github.com/changesets/changesets). When a change affects users of `jumper-cli`, run `bun changeset` and commit the file it makes. The release workflow opens a "Version Packages" pull request. Merge it to publish to npm.

## Licence

[MIT](LICENSE)
