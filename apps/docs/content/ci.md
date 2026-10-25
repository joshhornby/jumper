# Review and CI

Keep boards in the repository next to the code, and check them in every pull request like code.

## Check boards in CI

This GitHub Actions job fails when a board has an error or a gap, or is not formatted:

```yaml
name: Boards

on: pull_request

jobs:
  boards:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 22
      - run: npm install --global jumper-cli
      - run: |
          status=0
          for file in $(git ls-files '*.jumper'); do
            jumper check "$file" || status=1
            jumper fmt "$file" --check || status=1
          done
          exit $status
```

The loop checks every file before it fails, so one run shows every problem.

A board with a deliberate gap, such as a teaching example, fails `check`. Leave such files out of the loop.

## Review board changes

A text diff of a board shows which lines moved. `jumper diff` shows what the change means: which places, wires and stories changed, and which stories to read again.

```sh
git show main:board.jumper > /tmp/before.jumper
jumper diff /tmp/before.jumper board.jumper
```

```text
Places added: :error
Places changed: :save-card
Wires added: :error "Try again"
Wires retargeted: :save-card "declined" now leads to :error, not :setup
Stories to read again: "Card is declined"
```

Here the "declined" wire now leads to a new error screen. The story "Card is declined" still expects the form, so it is listed to read again, and `jumper check` reports it as [`via-leads-elsewhere`](diagnostics.md#via-leads-elsewhere).

To post this in a pull request, run `jumper diff` in CI and add the output as a comment. Use `--json` when a script reads the result.

## Keep the drawings current

Generate the SVG in CI, so the drawing in a spec or design review never drifts from the source:

```sh
jumper build board.jumper -o board.svg
jumper build board.jumper --story 1 -o board-story-1.svg
```
