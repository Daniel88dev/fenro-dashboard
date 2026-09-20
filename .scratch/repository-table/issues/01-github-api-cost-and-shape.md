# GitHub API cost and shape for this table

Type: research
Status: claimed
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
