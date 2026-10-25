# Jumper

Jumper is a small language for Shape Up breadboards. You write S-expressions. Jumper draws wireframe or breadboard boards and storyboards as SVG. It also checks that every story follows a real wire.

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

See [docs/language.md](docs/language.md) for the full language.

## Layout

| Path                         | Contents                                                         |
| ---------------------------- | ---------------------------------------------------------------- |
| `packages/jumper`            | The language: reader, compiler, checker, SVG renderer and CLI    |
| `apps/playground`            | The browser playground: editor, live board, stories and problems |
| `packages/typescript-config` | Strict TypeScript config, copied from Anvil                      |

## Use it

Install [Bun](https://bun.com), then install the dependencies:

```sh
bun install
```

Run the playground at http://localhost:3000:

```sh
bun run dev
```

Use the CLI:

```sh
bun packages/jumper/src/cli.ts check packages/jumper/examples/broken.jumper
bun packages/jumper/src/cli.ts build packages/jumper/examples/autopay.jumper --story 1 -o autopay.svg
```

`check` prints each problem with its source line and a suggested fix. It exits with 1 when the board has errors or gaps. Add `--json` to get the diagnostics as JSON for editors, scripts and agents. `build` options are `--breadboard`, `--no-notes` and `--story <n>`.

## Develop

```sh
bun test           # language tests
bun run typecheck  # all packages
bun run check      # Biome format and lint
bun run build      # playground production build in apps/playground/dist
```
