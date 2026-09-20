# GitHub API cost and shape for this table

Type: research
Status: open
Blocked by: —
Part of: [map](../map.md)

## Question

What is the cheapest and most reliable way to get this table's data out of
GitHub, and what does that cost constrain?

One row per repository needs an open pull request count, an open issue count and
a last-activity time. An expanded row needs the open pull requests with their
review state, and for each one a CI rollup plus every individual check with its
conclusion and duration. Scale is 5–30 repositories for one person.

Specifically:

- REST or GraphQL for this shape, and whether one GraphQL query can cover N
  repositories at once including per-PR review decision and check runs.
- The rate limits that actually bind — REST primary and secondary, GraphQL
  points per hour and how the cost is computed — and how far a token goes, for a
  user PAT versus a GitHub App installation token.
- Check runs versus check suites versus commit statuses: which gives a single CI
  rollup, and whether checks can be had without a round-trip per pull request.
- Whether ETags and conditional requests refund budget, and what that implies for
  a poll-and-cache design.
- Webhooks as an alternative to polling: which events cover this table, and what
  a receiver needs while staying portable between Vercel and AWS.
- Whether an "open issues" count double-counts pull requests, and the correct way
  to exclude them.

The answer feeds ticket 05 directly: if a live read per page view is affordable,
the snapshot machinery in the prototypes is unnecessary.

## Attempted, not resolved

Picked up on 2026-09-20 and **stopped unresolved**. It is back on the frontier,
unclaimed; the next session should take it.

The work needs official GitHub documentation — rate limit arithmetic, GraphQL
point costs and the check-runs endpoints are precisely the things that must not be
answered from memory. Fetching `docs.github.com` requires an approval this
environment could not obtain at the time, so the research stopped partway, before
any finding was established. **Nothing was written down, because a half-verified
rate limit is worse than an open ticket**: it would be believed and built on.

What it still needs, unchanged from the question above. When resuming, note that
the GitHub MCP tools can answer some of it empirically against a real repository
without fetching docs at all — a live call reveals the response shape, whether a
PR's checks need a second round-trip, and what the rate-limit headers actually
say. That is a decent substitute for the endpoint-shape questions, though not for
the documented GraphQL point formula.

This ticket blocks [05](./05-live-read-or-snapshot.md), the live-read-versus-
snapshot decision, which most of the map hangs off. Ticket
[02](./02-nextjs-16-data-strategy.md) already landed one finding that leans on 05:
no `use cache` entry survives a deploy, so on a rate-limited API the first visitor
after every deploy pays full cost for every visible row. How much that hurts is
exactly what this ticket's numbers would tell us.
