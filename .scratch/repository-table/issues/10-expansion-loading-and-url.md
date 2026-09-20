# Loading and URL strategy for the expansion

Type: grilling
Status: open
Blocked by: 05
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

## What slice 1 already assumes

Built, so the screen could ship, and recorded here rather than in the plan
because this ticket owns it. Each is cheap to change while the detail is fetched
per panel.

- **The detail is fetched on demand**, per open panel, behind its own query. So
  swapping inline expansion for something else stays a UI change.
- **Expansion lives in the URL**, as ticket 02 settled, encoded as one
  repeatable `open` parameter per open panel, written `owner/name:column`:
  `?open=nordwind/billing-core:prs&open=nordwind/docs-site:issues`. A pull
  request's checks are a separate repeatable `pr` parameter, `owner/name:number`,
  because they hang off a pull request rather than off the row. Closing a row's
  pull requests panel closes any pull request opened inside it, so the URL never
  carries state the reader cannot see.
- **A panel that fails renders its own message** and leaves the table standing.
- **Nothing streams per panel yet.** The screen awaits the open panels together,
  because the fakes are in memory and a `<Suspense>` boundary around an instant
  read buys nothing. Ticket 02's shape — a boundary per row's counts and a
  nested one per panel, with `cacheComponents: true` — goes in with the real
  GitHub reads in slice 3, which is when it starts to matter.

What is still open: whether the "Show the other 8" link leads anywhere inside
the app (today it points at GitHub), and what the loading and rate-limited
states say, which waits on 05.
