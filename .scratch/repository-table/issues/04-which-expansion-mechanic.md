# Which expansion mechanic, and may several rows be open at once?

Type: grilling
Status: **resolved** — 2026-09-20
Blocked by: —
Part of: [map](../map.md)

## Question

Five artboards exist. Which one is the screen?

1. **Inline under the row**, scoped to the column clicked, several rows open at
   once. The current working assumption.
2. **One panel with tabs per row**: the row opens once, the clicked column picks
   the tab, switching tabs does not collapse it.
3. **Side drawer**: the table never moves; a count opens a drawer and the next
   count swaps its contents.
4. **Dense table**: one line per repository so twenty fit on a screen, with a CI
   column showing every open PR's health as a row of dots.

Two sub-questions the artboards deliberately leave open:

- May two rows be expanded simultaneously, each on a different column? Artboard 2
  says yes. Allowing it costs a taller page and several detail fetches in flight;
  forbidding it makes comparison a matter of memory.
- Does the comparison the table exists for survive the detail? The dense variant
  is the best overview and the worst for detail; the drawer is the reverse.

## Answer

**Artboard 1, and yes.** Daniel picked the first two artboards on 2026-09-20:
inline expansion under the row, scoped to the column clicked, and several rows
open at once on different columns. What was a recorded assumption is now the
decision, and the drawer, the tabbed panel and the dense table are not the
screen.

Consequences, built in slice 1:

- The URL parameter has to be **repeatable**, one entry per open panel, which is
  what `?open=owner/name:column` is. The exact encoding is ticket 10's to
  confirm.
- Several panels can be in flight at once, so each one loads and fails on its
  own — a panel's error must not take the table down.
- The page gets taller as rows open, so expanding must not scroll or move focus.

The alternatives stay in the prototype canvas as a record of what was
considered, not as options still on the table.
