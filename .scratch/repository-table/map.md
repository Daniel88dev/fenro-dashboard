# Map: the repository table

Label: `wayfinder:map`
Tracker: local markdown (`docs/agents/issue-tracker.md`)

## Destination

A spec complete enough to build the repository table end to end — the screen in
[`docs/ui/repository-table.md`](../../docs/ui/repository-table.md), backed by the
`github-insights` and `tasks` bounded contexts — with every architectural
decision it depends on settled, so that implementation is execution and not
discovery. The route through the architecture is drafted in
[`docs/implementation-plan.md`](../../docs/implementation-plan.md); this map holds
what that plan still has to guess at.

Reaching the destination does **not** mean the screen is built. It means nothing
is left to decide before someone builds it.

## Notes

**Domain.** A Next.js 16 fullstack app that is two things at once: an advanced
GitHub dashboard over a handful of watched repositories, and an agentic task list
whose tasks carry context from one agent session to the next. Roughly 5–30
watched repositories, one user.

**Skills every session should consult.** `grilling` and `domain-modeling` by
default; `research` for anything outside the working directory; `prototype` when
the open question is how something should look or behave. `codebase-design`
before proposing new structure.

**Standing preferences for this effort.**

- The repo's [CLAUDE.md](../../CLAUDE.md) is the working agreement and wins over
  anything decided here. Dependencies point inwards; commands and queries are
  separate; aggregates own their invariants; expected failures are `Result`
  values; ports live with the code that needs them and adapters in
  `infrastructure/`; configuration is environment variables only.
- Portability is a constraint, not a preference: Vercel first, possibly AWS
  later, so no Vercel-only runtime API or storage.
- GitHub is the system of record for pull requests, issues and checks. This app
  owns no invariant over them. Any modelling that turns them into aggregates
  should be challenged.
- The expansion mechanic is no longer an assumption: **inline expansion under
  the row, several rows open at once** is what Daniel chose (ticket 04).
- "You" is the **GitHub account signed in with OAuth** (ticket 03), so the
  viewer and the credentials that read GitHub are per-request facts behind a
  port, never configuration.

## Decisions so far

<!-- one line per resolved ticket, then the link for the detail -->

- [Next.js 16 rendering and data strategy](./issues/02-nextjs-16-data-strategy.md):
  static shell → `<Suspense>` per row's counts → nested `<Suspense>` per expanded
  detail, with `cacheComponents: true` and all GitHub reads behind `'use cache'`
  query functions. Expansion state lives in the URL. Server Actions are rejected
  for the reads because Next dispatches them one at a time per client. Five
  concrete traps for the CQRS layering, the sharpest being that `React.cache` is
  isolated inside every `use cache` scope, so a request-scoped container silently
  stops being shared. Full findings in
  [`docs/research/nextjs-16-rendering-strategy.md`](../../docs/research/nextjs-16-rendering-strategy.md).
- [Who is "you"?](./issues/03-who-is-you.md): **Sign in with GitHub.** "You" is
  the signed-in account and the app holds a token per user, so the viewer and
  the GitHub credentials arrive per request and live behind ports. Unblocks the
  shape of 05 and 07; the login itself is not built.
- [Which expansion mechanic](./issues/04-which-expansion-mechanic.md): **inline
  expansion under the row, several rows open at once** — artboards 1 and 2. The
  drawer, the tabbed panel and the dense table are out. Forces a repeatable URL
  parameter and per-panel loading and error states.

- [Live read or synced snapshot](./issues/05-live-read-or-snapshot.md):
  **a synced snapshot in Postgres**, rendered server-side, refreshed by the
  server on Refresh or when a visit finds it over an hour old. The browser
  asks; it never fetches GitHub or posts records.

## Not yet specified

In scope, but not yet sharp enough to ticket. Each graduates as the frontier
reaches it.

- **Writing back to GitHub.** The prototypes are read-only apart from
  _Make a task from this_, which writes only to our own store. Whether the
  dashboard ever comments, closes, re-runs a check or merges is unasked, and it
  changes the token scopes ticket 03 settles.
- **What running an agent session actually means.** Tasks show
  `Session 1 running, 6 min in` and a **Watch** action. Whether the app launches
  sessions, or only records ones launched elsewhere, is the difference between a
  task list and an orchestrator. Blocked behind the tasks domain model (08).
- **Refresh cadence and who triggers it.** Depends entirely on 05. If it is a
  snapshot: background schedule, on-view refresh, webhooks, or only the
  **Sync now** button; and what runs the schedule somewhere portable.
- **Narrow viewports.** The only state still undrawn: empty, loading, error
  and rate-limited are built (see "States beyond the happy path" in the design
  doc). Five numeric columns plus a name do not survive a phone unchanged.
- **Where the GitHub response cache lives.** Surfaced by ticket 02: no `use cache`
  entry survives a deploy, because the build id is part of the cache key. On a
  rate-limited API with frequent deploys, the first visitor after each deploy pays
  full cost for every visible row. That pushes toward owning the cache in
  `infrastructure/` and letting `use cache` be a render concern only — but it is
  ticket 05's call, so it sharpens once 05 lands.
- **Deployment and secrets.** Where the token and the database URL live on
  Vercel and on AWS; whether anything needs to be long-running.
- **The Tasks page.** The nav has one. This map is about the Repositories screen;
  the standalone Tasks view is in scope for the product but has no prototype yet.

## Out of scope

Ruled beyond this destination. These never graduate; they would be a fresh
effort.

- **Building the agent runtime.** Fenro tracks tasks and the context they carry.
  It does not become the thing that executes agent sessions.
- **Multi-tenant SaaS.** Organisations, billing, per-team permissions. Ticket 03
  may settle on multi-user sign-in, but the product stays one person's dashboard.
- **Replacing GitHub's own screens.** Code review, diffs, merging, issue editing.
  The dashboard points at GitHub and gets out of the way.
- **Supporting anything other than GitHub.** No GitLab, no Bitbucket, and no
  provider abstraction built in anticipation of them.

## Tickets

Open children live in [`issues/`](./issues/). The frontier — open, unblocked,
unclaimed — is where to start.

| #   | Ticket                                                                                     | Type     | Blocked by | Status         |
| --- | ------------------------------------------------------------------------------------------ | -------- | ---------- | -------------- |
| 01  | [GitHub API cost and shape for this table](./issues/01-github-api-cost-and-shape.md)       | research | —          | open           |
| 02  | [Next.js 16 rendering and data strategy](./issues/02-nextjs-16-data-strategy.md)           | research | —          | **resolved**   |
| 03  | [Who is "you"?](./issues/03-who-is-you.md)                                                 | grilling | —          | **resolved**   |
| 04  | [Which expansion mechanic](./issues/04-which-expansion-mechanic.md)                        | grilling | —          | **resolved**   |
| 05  | [Live read or synced snapshot](./issues/05-live-read-or-snapshot.md)                       | grilling | 01, 02, 03 | **resolved**   |
| 06  | [What is an aggregate in github-insights](./issues/06-github-insights-domain-model.md)     | grilling | 05         | open           |
| 07  | [Where state lives, and how it stays portable](./issues/07-persistence-and-portability.md) | grilling | 03, 05     | open           |
| 08  | [What a task carries between sessions](./issues/08-tasks-domain-model.md)                  | grilling | 07         | open           |
| 09  | [How the Tasks column crosses the boundary](./issues/09-crossing-the-context-boundary.md)  | grilling | 06, 08     | open           |
| 10  | [Loading and URL strategy for the expansion](./issues/10-expansion-loading-and-url.md)     | grilling | 05         | defaults built |
