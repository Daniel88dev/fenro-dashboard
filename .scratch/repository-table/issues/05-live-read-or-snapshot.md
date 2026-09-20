# Live read, or a synced snapshot?

Type: grilling
Status: open
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
