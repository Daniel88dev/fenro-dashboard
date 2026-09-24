# Where does state live, and how does it stay portable?

Type: grilling
Status: resolved
Blocked by: 03, 05
Part of: [map](../map.md)

## Question

What actually persists, in what, reached how?

`DATABASE_URL` is already in the env schema as optional, so the shape of the
answer is expected to be a connection string — but what is on the other end and
how the app talks to it is undecided.

- What has to persist at all? Tasks and their context certainly. Watched
  repositories, if ticket 03 makes them per user. Mirrored GitHub data, if ticket
  05 chose a snapshot. Sessions and tokens, depending on 03.
- Which store: Postgres somewhere neutral, SQLite on a volume, something
  serverless. The binding constraint is that it must work identically on Vercel
  and on a container on AWS, which rules out anything tied to one platform.
- Which access layer: a query builder, an ORM, or hand-written SQL behind the
  repository ports. The conventions already say the interface belongs in
  `domain/` and the implementation in `infrastructure/`, so this is a choice
  about the adapter only — but migrations, connection pooling in a serverless
  runtime, and testability all ride on it.
- How adapters are composed per request without a module-level singleton that
  leaks across requests (see ticket 02).
- What the in-memory adapter looks like, so slices can ship and be tested before
  any of this is wired.

The last point matters most for sequencing: if an in-memory implementation of
every port is the first thing built, this decision can land late without blocking
the screen.

## Partly answered — 2026-09-22

Daniel chose **Postgres, reached through Drizzle** (`drizzle-orm` over the plain
`pg` driver and a `DATABASE_URL`), with `drizzle-kit` migrations checked in
under `drizzle/`. That works the same on Vercel with any hosted Postgres and on
a container next to RDS.

- Sessions and the per-user GitHub token now persist, in the identity context's
  tables (`src/modules/identity/infrastructure/persistence/schema.ts`).
- Each context keeps its tables next to its adapters at
  `infrastructure/persistence/schema.ts`; `drizzle.config.ts` globs them into
  one migration history.
- The pool is created on first use and shared per process
  (`src/shared/infrastructure/database/client.ts`); adapters get the database
  from the composition root.

Still open: what else persists (watched repositories per user or global, tasks,
and mirrored GitHub data if ticket 05 picks a snapshot), and the in-memory
adapters stay until those land.

## Answer — 2026-09-23

Postgres through Drizzle, reached by a plain `DATABASE_URL` (decided with
sign-in, ticket 03). Tasks keep their own tables in
`src/modules/tasks/infrastructure/persistence/schema.ts`: `task`, `task_link`,
`task_external_reference`, `task_session` and `task_journal_entry`. A task
carries a `version` column for optimistic concurrency. Agent access tokens live
in `identity` as `agent_access_token`. See
[the tasks design](../../../docs/tasks/agent-task-management.md#3-what-persists-ticket-07).
