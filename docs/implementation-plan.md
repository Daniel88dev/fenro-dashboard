# Implementation plan: the repository table

How the screen in [`docs/ui/repository-table.md`](./ui/repository-table.md) lands
on the two bounded contexts, and in what order to build it.

**Status: a draft route, not a settled design.** Everything here marked
_(proposed)_ is a position to be argued with, not a decision. The decisions this
plan is waiting on are tracked as tickets on the wayfinder map at
[`.scratch/repository-table/map.md`](../.scratch/repository-table/map.md); each
proposal below names the ticket that owns it. The plan and the map are one thing:
the map holds what is open, the plan holds the shape those answers will fill in.

Ground rules come from [CLAUDE.md](../CLAUDE.md) and are not re-litigated here.

## The shape of it

```
src/app/repositories/                route, thin: ask two queries, render
        │
        ▼  QueryBus
src/modules/github-insights/         src/modules/tasks/
  ui/            table, row, panels    ui/            task rows, brief
  application/   queries, commands     application/   queries, commands
    ports/       GitHubGateway           ports/       SessionRunner
  domain/        WatchedRepository       domain/      Task, Session, ContextItem
  infrastructure/ GitHub adapter         infrastructure/ store adapter
```

Both contexts stay ignorant of each other. The row that shows PR counts and task
counts side by side is assembled above them — see
[Crossing the boundary](#crossing-the-boundary).

## `github-insights`

### The central claim _(proposed — ticket 06)_

**`WatchedRepository` is the only aggregate in this context.** Pull requests,
issues and checks are read models, not domain objects, because GitHub is their
system of record and this app enforces no invariant over them. Modelling them as
aggregates would produce entities that can never be wrong and never be saved.

That makes the CQRS split unusually lopsided, and deliberately so: a small
command side that owns _which repositories we care about_, and a query side that
owns _everything the screen renders_.

### Domain

`src/modules/github-insights/domain/`

| File                               | What                                                                                                                  |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `watched-repository.ts`            | `WatchedRepository extends AggregateRoot`                                                                             |
| `repository-coordinates.ts`        | `RepositoryCoordinates extends ValueObject` — owner + name, validated, the only place a `owner/name` string is parsed |
| `sync-state.ts`                    | `SyncState extends ValueObject` — `lastSyncedAt`, `lastError`, whatever cursor ticket 01 turns out to need            |
| `events.ts`                        | `RepositoryWatched`, `RepositoryUnwatched`, `RepositorySynced`, `RepositorySyncFailed`                                |
| `watched-repository.repository.ts` | The port. A repository interface belongs in `domain/`; its implementation does not.                                   |

```ts
// domain/watched-repository.repository.ts
export interface WatchedRepositoryRepository {
  findById(id: UniqueId): Promise<WatchedRepository | undefined>;
  findByCoordinates(
    c: RepositoryCoordinates,
  ): Promise<WatchedRepository | undefined>;
  findAll(): Promise<WatchedRepository[]>;
  save(repository: WatchedRepository): Promise<void>;
  remove(id: UniqueId): Promise<void>;
}
```

Creation returns a `Result`, because bad coordinates are an expected failure and
not a bug:

```ts
// domain/watched-repository.ts
static watch(
  coordinates: RepositoryCoordinates,
  watchedAt: Date,
): Result<WatchedRepository, InvalidCoordinates>
```

### Commands

`src/modules/github-insights/application/commands/`. Each changes state and
returns nothing; the type is `<context>.<verb>`.

| Command                                         | Raised by                                                  |
| ----------------------------------------------- | ---------------------------------------------------------- |
| `github-insights.watch-repository`              | **Add repositories** in the toolbar, once per ticked repo  |
| `github-insights.unwatch-repository`            | Row menu                                                   |
| `github-insights.sync-repository`               | **Sync now** — exists only if ticket 05 chooses a snapshot |
| `github-insights.sync-all-watched-repositories` | The same, for the header's freshness indicator             |

`WatchRepositoryHandler` is where "the same repository cannot be watched twice"
is enforced, by asking `findByCoordinates` before constructing. Whether that is
an aggregate rule or a store constraint is exactly what ticket 06 grills.

### Queries and read models

`src/modules/github-insights/application/queries/`. Each query's result is a
plain read model shaped for the screen, never an aggregate handed to React.

| Query                                 | Result                 | Feeds            |
| ------------------------------------- | ---------------------- | ---------------- |
| `github-insights.repository-rows`     | `RepositoryRow[]`      | The table body   |
| `github-insights.dashboard-totals`    | `DashboardTotals`      | The page header  |
| `github-insights.open-pull-requests`  | `PullRequestSummary[]` | The PRs panel    |
| `github-insights.pull-request-checks` | `PullRequestChecks`    | An expanded PR   |
| `github-insights.open-issues`         | `IssueSummary[]`       | The issues panel |

The read models fall straight out of the prototype, which is the point of having
built it:

```ts
export type RepositoryRow = {
  id: string;
  owner: string;
  name: string;
  openPullRequests: number;
  openIssues: number;
  pullRequestHint: string; // "3 need you"
  issueHint: string; // "4 assigned"
  lastActivityAt: Date;
  syncedAt: Date | null;
};

export type PullRequestSummary = {
  number: number;
  title: string;
  author: string;
  openedAt: Date;
  reviewState:
    "your-review" | "changes-requested" | "approved" | "draft" | "none";
  checkRollup: "passed" | "failed" | "running" | "none";
  checkSummary: string; // "1 failed"
};

export type PullRequestChecks = {
  headSha: string;
  checks: {
    name: string;
    conclusion: "passed" | "failed" | "running" | "skipped";
    duration: string | null;
  }[];
  blockingReason: string; // "Tom requested changes 12 days ago…"
};
```

Note what is **not** in `RepositoryRow`: the task count. That belongs to the other
context.

### Ports and adapters

The port the context needs from the outside world lives in
`application/ports/github-gateway.ts` _(proposed — its exact shape waits on
ticket 01, which decides whether one call can serve N repositories)_:

```ts
export interface GitHubGateway {
  fetchRepositorySnapshot(
    c: RepositoryCoordinates,
  ): Promise<Result<RepositorySnapshot, GitHubUnavailable>>;
  fetchOpenPullRequests(
    c: RepositoryCoordinates,
  ): Promise<Result<PullRequestSummary[], GitHubUnavailable>>;
  fetchPullRequestChecks(
    c: RepositoryCoordinates,
    number: number,
  ): Promise<Result<PullRequestChecks, GitHubUnavailable>>;
  fetchOpenIssues(
    c: RepositoryCoordinates,
  ): Promise<Result<IssueSummary[], GitHubUnavailable>>;
}
```

Adapters in `infrastructure/`: a real GitHub client reading its token through
`getEnv()`, and — built first — an in-memory fake seeded with the prototype's
sample data. Rate limiting and conditional requests live in the adapter, where
they belong, and never leak into a query handler.

## `tasks`

_(Built — ticket 08, decided by Daniel.)_ The full model, the research behind
it and the MCP tool list are in
[docs/tasks/agent-task-management.md](./tasks/agent-task-management.md). In
short:

- **`Task`** — the aggregate, one per task and per sub-task. A sub-task is a
  task with a parent; "A blocks B" is stored on B. It owns its acceptance
  criteria, external references (GitHub, Jira, Linear, any URL), links,
  sessions and journal.
- **`Session`** — an entity inside `Task`: one live session per task, held on a
  two-hour lease any write from its holder renews.
- **Journal entries** — appended, never edited. They replace the "context
  items" of the prototype, and the handoff brief is derived from them on every
  read.
- **`TaskGraph`** — the domain service for the rules no single task can see:
  no task may end up waiting on itself through blocking or parenting.

Commands (`tasks.create-task`, `update-task`, `start-task`, `finish-session`,
`record-note`, `check-criterion`, `link-tasks`, `change-status`) may be refused,
and return `Result` so an agent reads why. Queries are `list-tasks`,
`task-brief`, `task-counts-by-repository` and `tasks-for-repository`. Agents
reach all of them through the MCP server at `/api/mcp`, authenticated by a
personal access token from `identity`.

## Crossing the boundary

One row shows data from two contexts, and neither may import the other.

_(Proposed — ticket 09.)_ **Join in the route.** The server component for
`/repositories` asks both buses and zips the results on `owner/name`:

```ts
const [rows, taskCounts] = await Promise.all([
  queryBus.ask(repositoryRowsQuery()),
  queryBus.ask(taskCountsByRepositoryQuery()),
]);
```

The dashboard is the thing that wants both; neither context does. The join key is
a plain string pair rather than a shared identifier, so the contexts stay
uncoupled — at the cost of going stale when a repository is renamed, which is a
trade ticket 09 should name out loud before accepting.

The alternative on the map is a third `dashboard` module owning the combined read
model. It is more honest about the composition being a real concept and costs a
module whose only job is a join.

## Rendering and data strategy _(settled — ticket 02)_

Researched against the vendored docs of the installed `next@16.3.5` and verified
against the shipped types; full findings in
[`docs/research/nextjs-16-rendering-strategy.md`](./research/nextjs-16-rendering-strategy.md).

The screen renders as a static shell, with one `<Suspense>` per row's counts and a
nested one per expanded detail, so several open rows stream in parallel instead of
queueing. Expansion state lives in the URL as a repeatable `?open=owner/repo`
param. `cacheComponents: true` goes in `next.config.ts`, and every GitHub read
sits behind a `'use cache'` function with an explicit `cacheLife` and a
per-repository `cacheTag`.

Four findings change the design above, rather than merely the components:

1. **`'use cache'` belongs on the query handler's read function, below the bus —
   never around the bus.** `React.cache` is isolated inside each `use cache`
   scope, so a request-scoped composition root called from inside one silently
   stops being shared: every cached query would get its own container and its own
   deduplication. On a rate-limited API that means duplicated GitHub calls with
   correct-looking results. Build the container in `cache()` _outside_ every
   cached scope, and pass plain arguments in.
2. **Read models must be plain objects, and now provably so.** Class instances
   cannot cross an RSC serialization boundary, so `Entity`, `AggregateRoot`,
   `ValueObject` and `UniqueId` can never be arguments to or returns from a cached
   function, nor props to a client component. The conventions already said query
   handlers return read models; the framework now enforces it.
3. **`Result<T, Error>` should not cross a cache or server/client boundary**,
   because `Error` is a class instance. Prefer
   `Result<T, { code: string; message: string }>` for anything a query handler
   returns — which is what the `GitHubUnavailable` shape in the port sketch above
   should be.
4. **Credentials must be read above the cached scope and passed in.** The
   request-API restriction follows the call stack: an adapter that reaches for
   `headers()`, or calls a helper that does, fails with
   `next-request-in-use-cache` — and on a dynamic route that can pass `next build`
   and fail under `next start`. `getEnv()` is safe because it reads `process.env`,
   but if ticket 03 lands on per-user sign-in the token comes from a session, and
   the `GitHubGateway` port must take credentials as an argument. Worth designing
   for now, since it is free before the adapter exists.

Two consequences beyond the screen. `revalidateTag(tag, profile)` takes a
**required** second argument in this version, and the tag vocabulary is shared
between the query side (which calls `cacheTag`) and the command side (which calls
`updateTag`), so it belongs in one module under `application/` where the two
cannot drift. And the README's "Moving to AWS later" section is now incomplete for
Next 16: it predates `cacheHandlers` and `refreshTags()` for cross-instance tag
invalidation, the build-time `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, `deploymentId`,
and the fact that an AWS ALB may buffer responses and silently defeat streaming.
Left as it is here rather than rewritten, since it describes a deployment decision
that is Daniel's to make.

## The order of work

Slices, each shippable, each proving something. The first three need no decision
from the map, which is the point: the screen can start while the architecture
argument is still running.

### Slice 0 — the table, on fake data _(built)_

Route `/repositories`; the `repository-rows` and `dashboard-totals` queries; an
in-memory read-model adapter seeded with the prototype's sample repositories; the
table, row and header components; the palette as Tailwind v4 `@theme` tokens in
`globals.css`.

No GitHub, no store, no aggregate. Ships the entire visual design and proves the
query bus reaches a React server component.

_Proven by:_ a query-handler test, and a Testing Library test that the table
renders six rows with the right counts.

### Slice 1 — expansion, still fake _(built)_

The counts become buttons; panels open beneath the row; the PR, issue and task
panels render from `open-pull-requests`, `open-issues` and `tasks-for-repository`
against the same fakes. Includes the checks view inside an expanded PR.

This is where the interaction from ticket 04 becomes real, and where the
accessibility requirements in the design doc get met and tested.

_Proven by:_ a test that clicking a count reveals the panel and sets
`aria-expanded`, and that collapsing returns focus.

### Slice 2 — `WatchedRepository` _(built)_

The aggregate, its value objects, events and repository port; the `watch` and
`unwatch` commands; an in-memory repository; the **Watch a repository** form as a
thin server action. The table now lists what is actually watched, still with fake
counts.

_Proven by:_ domain tests for the invariants, a handler test for the duplicate
rule, and a test that unwatching removes the row.

Three things the first three slices decided as they were built, none of which
the plan had named:

- **`WatchedRepository.watch` does not return a `Result`.** The only expected
  failure, coordinates that are not a repository, belongs to
  `RepositoryCoordinates.create`, so an aggregate can never hold an invalid one.
- **The panel queries return a summary and a total, not a bare array.** A panel
  shows what needs attention and says how much it is not showing, which a
  `PullRequestSummary[]` cannot carry.
- **Watching is idempotent rather than an error.** A command bus returns
  nothing, so the "already watching" message is the route's, asked as a query
  before dispatch; the handler enforces the rule by refusing to create a second
  aggregate.

`cacheComponents` is still off and there is no `<Suspense>` boundary per panel:
ticket 02's rendering shape is what slice 3 turns on, when the reads are remote
and the boundaries start to earn their keep.

**Slices 3 onward need the map.** Do not start them before the ticket named.

### Slice 3 — real GitHub data, synced _(built)_

Ticket 05 answered: a synced snapshot. `WatchedRepository` is stored in
Postgres per signed-in user and carries a `SyncState` that decides when GitHub
may be asked again. `sync-watched-repositories` reads each due repository with
one GraphQL query through the `GitHubGateway` adapter and swaps its snapshot
(pull requests with reviews and checks, issues, both totals) in one
transaction. The query side reads the snapshot behind the unchanged
`RepositoryInsightsReader` port, and works out "needs you" per viewer when it
reads. The header shows `Synced 12 min ago` and a Refresh button; a page whose
rows are over an hour old syncs on its own once it is on screen.

This also brought slices 4 and 5 forward: the pull request panel, the checks
view and the issues panel all read the same snapshot.

### Slice 4 — real pull requests and checks _(built)_

Every open panel, and every open pull request's checks inside one, renders
behind its own `<Suspense>` boundary and its own error boundary (`catchError`
from `next/error`), so several rows open at once load side by side, a panel
still on its way shows its title and `Loading pull requests…`, and one that
throws shows `The pull requests could not be loaded.` with **Try again**
while the rest of the table stands. Failures a query can explain still come
back as values and render their own message. `cacheComponents` stays off: the
panels read Postgres per viewer, which `'use cache'` has nothing to add to.

When GitHub refuses a sync because the rate limit ran out, `SyncState`
records that kind of failure, waits 15 minutes rather than 5 before retrying
on its own, and the sync stops asking about the repositories it has not
reached yet. The header says it once — `GitHub's rate limit is used up.
Showing numbers from 20 min ago.` — and each affected row only says
`Not refreshed: rate limit used up`.

### Slice 5 — real issues _(built)_

The issues panel's filter chips: **Assigned to me**, **Needs triage** (no
label yet) and **Oldest first**, pressed independently and kept in the URL as
a repeatable `issues=owner/name:chip`. Filtering happens in the query's
projection, over the issues the last sync stored. When the sync stored every
open issue, the footer counts the rest of the matches; when it stored only the
most recently updated ones, the footer says so and links to GitHub's own
search with the same narrowing.

"Show the other N" still leads to GitHub, now to a search that mirrors the
pressed chips, rather than to an in-app list: the snapshot holds at most 50 of
each, and replacing GitHub's own lists is out of scope on the map.

### Slice 6 — the `tasks` context _(built)_

`Task`, sub-tasks, blocking, sessions, the journal and external references, in
Postgres. The Tasks column and panel read real tasks, joined in the route on
`owner/name` (ticket 09).

### Slice 7 — agents _(built)_

The MCP server at `/api/mcp` and personal access tokens, made and revoked on
**Settings**. An agent can list the ready queue, claim a task, record what it
learns and hand off.

### Slice 8 — the Tasks page and the seam

The Tasks screen (list, detail with the journal, creating and editing by
hand), **New task here** and **Make a task from this**: a task created already
carrying the pull request it came from.

## What this plan is guessing

Stated plainly, so nobody mistakes a proposal for a decision:

| Guess                                                          | Ticket                                                                       |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| A snapshot with a sync, rather than a live read                | [05](../.scratch/repository-table/issues/05-live-read-or-snapshot.md)        |
| `WatchedRepository` is the only aggregate in `github-insights` | [06](../.scratch/repository-table/issues/06-github-insights-domain-model.md) |
| Expansion detail is fetched on demand                          | [10](../.scratch/repository-table/issues/10-expansion-loading-and-url.md)    |

Two of the original guesses are no longer guesses. Daniel settled the expansion
mechanic ([04](../.scratch/repository-table/issues/04-which-expansion-mechanic.md):
inline under the row, several rows open at once) and the identity
([03](../.scratch/repository-table/issues/03-who-is-you.md): sign in with
GitHub, a token per user rather than one in the environment). Tickets 07, 08
and 09 were settled with the tasks context: Daniel chose one aggregate per task
and sub-task, and the rest follows
[the tasks design](./tasks/agent-task-management.md).
