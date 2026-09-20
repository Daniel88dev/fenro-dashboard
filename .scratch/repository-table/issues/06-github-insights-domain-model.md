# What is an aggregate in `github-insights`?

Type: grilling
Status: open
Blocked by: 05
Part of: [map](../map.md)

## Question

Which things in this context own invariants, and which are merely data we read?

The proposal to grill against: **`WatchedRepository` is the only aggregate**. It
owns the decision to watch a repository, its coordinates, and the state of its
synchronisation. Pull requests, issues and checks are **read models**, because
GitHub is their system of record and this app enforces no rule over them —
modelling them as aggregates would create entities that can never be wrong and
can never be saved.

If that holds, the context has one aggregate and four read models
(`RepositoryRow`, `PullRequestSummary`, `PullRequestChecks`, `IssueSummary`),
and the CQRS split is unusually clean: one command side with almost nothing in
it, one query side with everything the screen needs.

Grill it:

- Does `WatchedRepository` have a real invariant, or is it a row in a list? If
  the only rule is "the same repository cannot be watched twice", is that an
  aggregate rule or a uniqueness constraint in the store?
- Where does sync state live — on the aggregate as a value object, or beside it?
  Putting it on the aggregate means every refresh is a write to the write model.
- If ticket 05 chose a snapshot, do the mirrored pull requests and issues become
  persisted read models projected from a sync, and is the projection a domain
  event handler or just an adapter writing what it fetched?
- What domain events are real here — `RepositoryWatched`, `RepositoryUnwatched`,
  `RepositorySynced`, `RepositorySyncFailed` — and does anything listen to them?
  An event nobody consumes is ceremony.

Call the `domain-modeling` skill alongside `grilling` for this one.
