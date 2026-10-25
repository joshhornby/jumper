# Getting started

This page takes you from an empty folder to a checked, drawn board in about ten minutes.

## Install

Jumper's CLI is the npm package `jumper-cli`. It needs [Node.js](https://nodejs.org) 20 or later. Install it globally with your package manager:

::: code-group

```sh [npm]
npm install --global jumper-cli
```

```sh [pnpm]
pnpm add --global jumper-cli
```

```sh [yarn]
yarn global add jumper-cli
```

```sh [bun]
bun add --global jumper-cli
```

:::

Check that it works:

```sh
jumper --version
```

You do not need to install anything to try Jumper. The [playground](playground-guide.md) runs in the browser.

### Run from a clone

To work on Jumper itself, clone the repository and install [Bun](https://bun.com). Then run the CLI from source:

```sh
git clone https://github.com/joshhornby/jumper.git
cd jumper
bun install
bun packages/cli/src/cli.ts check packages/jumper/examples/autopay.jumper
```

## Write a first board

Make a file called `sign-up.jumper`. A Jumper file holds one board. A board holds places, and each place has an id and a title:

```jumper
(board "Sign up"
  (screen :form "Sign up"
    (field "Email")
    (primary "Create account"))
  (screen :welcome "Welcome"
    (title "You are in")))
```

The two screens are not joined yet. Nothing leads to `:welcome`, but Jumper does not report it. A place with no wire in is an entry point. See [Errors and gaps](checks.md#what-jumper-does-not-report).

## Add a wire

Add `-> :id` to an affordance to wire it to a place:

```jumper
(board "Sign up"
  (screen :form "Sign up"
    (field "Email")
    (primary "Create account" -> :welcome))
  (screen :welcome "Welcome"
    (title "You are in")))
```

The wire leaves the screen at the height of the button.

## Add a system

Most flows depend on code that the user does not see. Model it as a `system` with one `(out …)` for each outcome:

```jumper
(board "Sign up"
  (screen :form "Sign up"
    (field "Email")
    (primary "Create account" -> :create))
  (system :create "Create account"
    (out "created" -> :welcome)
    (out "email taken" -> :form))
  (screen :welcome "Welcome"
    (title "You are in")))
```

## Tell a story

A story walks through the board one step at a time. Each step names a place and says what happens there:

```jumper
(board "Sign up"
  (screen :form "Sign up"
    (field "Email")
    (primary "Create account" -> :create))
  (system :create "Create account"
    (out "created" -> :welcome)
    (out "email taken" -> :form))
  (screen :welcome "Welcome"
    (title "You are in")))

(story "New user signs up"
  (step :form "Enters an email" :touch "Email")
  (step :create "Account is created" :via "created")
  (step :welcome "Sees the welcome screen"))
```

Jumper checks each hop between steps. The hop from `:form` to `:create` has exactly one wire, so Jumper infers it. The hop from `:create` has two wires, so the step names the one it means with `:via`.

## Check the board

Save the file and run:

```sh
jumper check sign-up.jumper
```

A clean board prints `No errors and no gaps.` and exits with 0. Now break the story. Change `:via "created"` to `:via "Created"`:

```jumper check
(board "Sign up"
  (screen :form "Sign up"
    (field "Email")
    (primary "Create account" -> :create))
  (system :create "Create account"
    (out "created" -> :welcome)
    (out "email taken" -> :form))
  (screen :welcome "Welcome"
    (title "You are in")))

(story "New user signs up"
  (step :form "Enters an email" :touch "Email")
  (step :create "Account is created" :via "Created")
  (step :welcome "Sees the welcome screen"))
```

`:via` must match the text exactly. The story is a contract for the real interface. Jumper suggests the exact text, and `check` exits with 1.

## Draw the board

```sh
jumper build sign-up.jumper -o sign-up.svg
jumper build sign-up.jumper --story 1 -o story.svg
jumper build sign-up.jumper --breadboard -o breadboard.svg
```

`--story 1` draws the first story on the board. `--breadboard` draws the classic breadboard style: place names and affordances as text.

## Format the file

```sh
jumper fmt sign-up.jumper --write
```

`fmt` prints one canonical layout, so the same board always diffs the same. See [Formatting](formatting.md).

## Next steps

- Try the same board in the [playground](playground-guide.md).
- Read [Core concepts](concepts.md), then the [Syntax](syntax.md) rules.
- Look up every command in the [CLI reference](cli.md).
