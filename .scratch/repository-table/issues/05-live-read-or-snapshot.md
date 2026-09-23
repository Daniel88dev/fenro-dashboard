# Live read, or a synced snapshot?

Type: grilling
Status: resolved
Blocked by: 01, 02, 03
Part of: [map](../map.md)

## Question

Does the app read GitHub when the page is rendered, or does it mirror GitHub into
its own store and serve the table from there?

The prototypes assume the second: a `synced 4 min ago` indicator in the top bar
and a **Sync now** button in the toolbar. Neither survives a live read.

This is the hinge of the whole map. It decides:

- whether `github-insights` has any persistent state at all, and therefore how
  much ticket 07 has to store;
- whether the counts can be trusted to be current, and what the header says when
  they are not;
- whether a rate-limit exhaustion is a page error or a stale snapshot;
- whether anything must run on a schedule, which is the portability question
  (Vercel cron and AWS are not the same shape);
- whether there is a `sync-repository` command at all, or only queries.

Answer it against ticket 01's cost findings and ticket 02's caching findings —
"live read with an HTTP cache in front" is a third answer that may make the
question moot, and is worth naming explicitly before choosing.

Ticket 03 matters here because a per-user token changes what can be cached and
shared.

## Answer — 2026-09-23

**A synced snapshot in Postgres**, Daniel's call: records of repositories, pull
requests, approvals, CI checks and issues live in our database, pages are
server-rendered from it, and refreshes go through the app. GitHub is often
unavailable, and the rate limit should not be spent per page view.

Daniel asked whether the browser could fetch GitHub itself and post the records
back. It could (GitHub allows browser calls), but it was turned down: rate
limits are per token wherever the call comes from, so it saves nothing; the
browser would need the `repo`-scoped token; the server could not trust posted
records without re-reading GitHub; and only the server can dedupe two tabs. So
the browser asks for a sync and the server does it.

What that settles:

- `github-insights` persists: `WatchedRepository` (per signed-in user) with its
  sync state, and a snapshot per watched repository.
- `sync-watched-repositories` exists, with a `manual` (Refresh) and an
  `automatic` (stale on visit) trigger. `SyncState` owns the policy: stale
  after an hour, Refresh ignored within a minute of the last attempt, a
  failure not retried on its own for five minutes, a two-minute lease so a
  crashed sync does not block the next.
- Nothing runs on a schedule, so there is nothing platform-specific to port.
- A rate-limit exhaustion is a stale snapshot with a note on the row, not a
  page error.
- For ticket 01: one GraphQL query per repository covers both counts, reviews,
  the check rollup and every check on each pull request's head commit.
