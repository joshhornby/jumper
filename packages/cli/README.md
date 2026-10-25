# jumper-cli

The `jumper` command for [Jumper](https://jumper.joshhornby.com/), a small language for user flows and wireframes. Write a board as text. Jumper draws it as SVG and checks that every story follows a real wire.

```sh
npm install --global jumper-cli
```

It needs Node.js 20 or later. pnpm, Yarn and Bun work too.

```sh
jumper check board.jumper                  # report errors and gaps, add --json for tools
jumper build board.jumper -o board.svg     # draw the board, add --story 1 to draw a story
jumper fmt board.jumper --write            # format in the canonical layout
jumper diff before.jumper after.jumper     # compare two versions by meaning
jumper scenarios board.jumper              # turn each story into a test scenario
```

- [Documentation](https://jumper.joshhornby.com/)
- [CLI reference](https://jumper.joshhornby.com/cli)
- [Playground](https://jumper.joshhornby.com/playground/)

MIT licence.
