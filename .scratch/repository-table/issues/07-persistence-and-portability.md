# Where does state live, and how does it stay portable?

Type: grilling
Status: open
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
