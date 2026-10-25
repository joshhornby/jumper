# Boards and regions

## Board

```lisp
(board "Title"
  …regions
  …places)
```

The board is the top-level form. Its title is a string and is required. A file holds exactly one board. A second board is the error [`duplicate-board`](diagnostics.md#duplicate-board), and a file with no board is the error [`missing-board`](diagnostics.md#missing-board).

The board holds regions and places, in any order. It cannot hold a story. Write each story at the top level, outside the board.

## Regions

```lisp
(region "Title" "Question this region answers"
  …places)
```

A region groups the places that answer one design question. Jumper draws the region as a numbered panel with its title and question.

- The title is required.
- The question is optional. When the second argument is a string, it is the question.
- Regions are numbered from 1 in source order.
- A region holds only places. It cannot hold another region.

```jumper
(board "Volunteer sign-up"
  (region "Find a shift" "Can a volunteer find a shift in one visit?"
    (screen :shifts "Shifts"
      (list "Sat 9 am" "Sun 2 pm")
      (button "Choose" -> :confirm)))
  (region "Commit" "Does the volunteer know they are booked?"
    (screen :confirm "Confirm shift"
      (primary "Book it" -> :booked))
    (screen :booked "Booked"
      (title "See you on Saturday"))))
```

## Places outside a region

A place directly inside the board is drawn without a panel. Use this for a small board, or for places that belong to no question, such as a shared sign-in screen.

```jumper
(board "Tiny"
  (screen :start "Start"
    (button "Go" -> :end))
  (screen :end "End"
    (title "Done")))
```

## How to choose regions

A good region answers one question that the design must settle. The region's places are the minimum needed to answer it. When a region grows past four or five places, it often holds two questions. See [Designing a flow](designing.md).
