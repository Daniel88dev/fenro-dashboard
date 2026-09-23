# Loading and URL strategy for the expansion

Type: grilling
Status: defaults built, open for Daniel to overturn
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

## What slice 4 settled by default

Ticket 05 landed (a synced snapshot), so the panels read Postgres, not
GitHub. Built on 2026-09-23 with these defaults; each is cheap to change:

- **Streaming per panel.** Every open panel, and every open pull request's
  checks, has its own `<Suspense>` and its own error boundary (`catchError`
  from `next/error`). `cacheComponents` stays off, because nothing here is
  shared between viewers for `'use cache'` to keep.
- **Loading copy**: the panel's own title, then `Loading pull requests…` (or
  issues, or tasks) and three placeholder lines; `Loading the checks for
#476…` for an open pull request.
- **Error copy**: `The pull requests could not be loaded.` with **Try again**
  for a panel that throws, fixed text because production redacts server
  error messages. Failures a query can explain keep their own sentence.
- **Rate-limited copy**: said once in the header, `GitHub's rate limit is used
up. Showing numbers from 20 min ago.`; rows say `Not refreshed: rate limit
used up`. The sync stops at the first rate-limited answer and waits 15
  minutes before retrying on its own.
- **"Show the other 8" leads to GitHub**, as a search that mirrors any pressed
  issue chips, rather than to an in-app list: the snapshot stores at most 50
  of each, and replacing GitHub's lists is out of scope on the map.
- **Issue chips in the URL** as a repeatable `issues=owner/name:chip`,
  released when the row's issues panel closes, like its pull requests.
