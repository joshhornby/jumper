# The playground

The playground is a browser editor for Jumper. Type on the left, and the board, the stories and the problems update as you type.

## Open it

The playground is part of this site. Select **Playground** at the top of any page.

To run it from a clone of the repository:

```sh
bun run dev
```

Then open http://localhost:3000.

## The screen

| Area                  | What it shows                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| **Source** (left)     | The editor. It highlights the syntax, completes form names and place ids, and underlines each problem. |
| **Board** (middle)    | The drawn board. Use the zoom buttons to zoom in and out.                                              |
| **Side pane** (right) | **My boards**, **Stories**, the problem list and the legend.                                           |

The two buttons at the ends of the toolbar show and hide the source and the side pane.

When the source has an error, the board shows the last good version until you fix the error.

## Toolbar

| Control                         | What it does                                                                                        |
| ------------------------------- | --------------------------------------------------------------------------------------------------- |
| Example menu                    | Opens an example or one of your saved boards.                                                       |
| **Save**                        | Saves the board in this browser. The shortcut is Ctrl+S or Cmd+S.                                   |
| **Wireframes** / **Breadboard** | Draws wireframe screens, or the classic breadboard style with place names and affordances as words. |
| **Notes**                       | Shows or hides `(note …)` and `(question …)` text under places.                                     |
| **Format**                      | Formats the source in the canonical layout. The shortcut is Shift+Alt+F.                            |
| **Share**                       | Copies a link that holds the whole source. Anyone with the link sees the same board.                |
| **Copy SVG**                    | Copies the drawn board as SVG text.                                                                 |
| **Download**                    | Downloads the drawn board as an SVG file.                                                           |

## Stories and problems

**Stories** lists every story. Select a story to draw its path on the board. Select **Whole board** to go back. A dashed story wire means Jumper inferred the wire, because the step has no `:via`.

The problem list shows each error and gap. When the board has none, it says "No gaps. Every story follows a real wire."

## Quick fixes

Many problems come with a fix, such as the correct spelling of an id. Hover over the underline in the editor and select **Fix** to apply it. The same fixes show in the [CLI](cli.md#check) and in [JSON output](json.md#fix).

## Save your boards

**Save** keeps the board in this browser. **My boards** in the side pane lists your saved boards. From there you can:

- open a board,
- rename or delete a board,
- **Save as new** to keep a copy,
- **Import** a `.jumper` file,
- **Export** the open board as a `.jumper` file.

The browser is the only copy of a saved board. Export a board to keep it safe or to add it to a repository. The playground keeps at most 200 boards.

## Share links

**Share** puts the source in the link, compressed, after `#s=`. The source does not go to a server. Every example in these docs has an **Open in playground** link that works the same way.
