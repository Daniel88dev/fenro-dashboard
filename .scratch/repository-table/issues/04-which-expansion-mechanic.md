# Which expansion mechanic, and may several rows be open at once?

Type: grilling
Status: open
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

The prototype already exists
([canvas](https://claude.ai/artifact/CHoCsPDAWY2tvnoL7gHW9t)), so this is a
conversation over artboards rather than a new prototype — unless the answer is
"none of these", in which case it becomes a prototype ticket.

Two sub-questions the artboards deliberately leave open:

- May two rows be expanded simultaneously, each on a different column? Artboard 2
  says yes. Allowing it costs a taller page and several detail fetches in flight;
  forbidding it makes comparison a matter of memory.
- Does the comparison the table exists for survive the detail? The dense variant
  is the best overview and the worst for detail; the drawer is the reverse.

This is a decision only a human can make, and it gates ticket 10.
