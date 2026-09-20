# Loading and URL strategy for the expansion

Type: grilling
Status: open
Blocked by: 02, 04, 05
Part of: [map](../map.md)

## Question

When a count is clicked, where does the detail come from and what does the URL do?

- Is the expanded detail **fetched on demand** or rendered with the table? On
  demand keeps the first paint fast and the rate-limit cost proportional to what
  is actually opened — which is why the design doc claims the expansion mechanic
  is cheap to change. Rendering it up front is simpler and wrong at 30
  repositories.
- Does expansion state live in the **URL**? A URL that reopens
  `billing-core → PRs → #476` is shareable, survives a refresh, and is the thing
  you paste into a task. It also means every expand is a navigation, which
  ticket 02 must confirm is cheap in this version. Client state is cheaper and
  loses all of that.
- If several rows may be open at once (ticket 04), how does that encode in a URL
  without becoming unreadable?
- What renders while the detail is in flight, and what renders when it fails —
  per panel, without taking the table down. This is where the "Not yet drawn"
  loading and error states in the design doc get settled.
- Does opening a pull request's checks cost another round-trip, or did the panel
  already fetch them? Ticket 01 decides whether that is even a choice.

The answer is what makes the expansion mechanic reversible. If detail is fetched
per panel behind a query, swapping inline expansion for a drawer is a UI change
and nothing more.
