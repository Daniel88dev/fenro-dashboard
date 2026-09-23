# Fenro Dashboard

An advanced GitHub dashboard for the repositories you care about — open pull
requests and issues at a glance — and, in the same app, an agentic task list
that carries context from one session to the next.

The repository table is real: watch a repository and the app copies its open
pull requests, reviews, CI checks and open issues from GitHub into Postgres,
then serves the page from there. The Tasks column still runs on sample data.

## Stack

| Concern    | Choice                                               |
| ---------- | ---------------------------------------------------- |
| Framework  | Next.js 16 (App Router, Turbopack) on React 19       |
| Language   | TypeScript, `strict`                                 |
| Styling    | Tailwind CSS v4                                      |
| Validation | Zod                                                  |
| Database   | Postgres via Drizzle ORM (`pg` driver), drizzle-kit  |
| Sign-in    | Better Auth, GitHub OAuth only                       |
| Tests      | Vitest + Testing Library (jsdom)                     |
| Lint       | ESLint (`eslint-config-next`) + Prettier             |
| Packages   | pnpm, lockfile committed                             |
| CI         | GitHub Actions on pull requests and pushes to `main` |

## Getting started

```bash
pnpm install
cp .env.example .env.local   # then fill it in, see below
docker compose up -d         # local Postgres, matching DATABASE_URL
pnpm db:migrate              # create the tables
pnpm dev
```

The app runs at http://localhost:3000, and `GET /api/health` is a liveness
probe.

### Signing in with GitHub

GitHub is the only way to sign in, through a GitHub OAuth app you own:

1. Open [GitHub → Settings → Developer settings → OAuth Apps → New OAuth
   App](https://github.com/settings/applications/new).
2. **Homepage URL**: `http://localhost:3000`. **Authorization callback URL**:
   `http://localhost:3000/api/auth/callback/github`. Both must match `APP_URL`.
3. Register it, then **Generate a new client secret**.
4. Put the client id and secret in `.env.local` as `GITHUB_CLIENT_ID` and
   `GITHUB_CLIENT_SECRET`, and set `BETTER_AUTH_SECRET` to the output of
   `openssl rand -base64 32`.

An OAuth app has exactly one callback URL, so use one app for local development
and a second one for production.

The app asks GitHub for `read:user`, `user:email` and `repo`. `repo` is what
lets it read pull requests and issues in private repositories; OAuth apps have
no read-only form of it.

### Scripts

| Script             | What it does                                |
| ------------------ | ------------------------------------------- |
| `pnpm dev`         | Dev server                                  |
| `pnpm build`       | Production build                            |
| `pnpm start`       | Serve the production build                  |
| `pnpm lint`        | ESLint (`lint:fix` to autofix)              |
| `pnpm typecheck`   | `tsc --noEmit`                              |
| `pnpm format`      | Prettier write (`format:check` to verify)   |
| `pnpm test`        | Vitest once (`test:watch`, `test:coverage`) |
| `pnpm db:generate` | Write a migration from the schema changes   |
| `pnpm db:migrate`  | Apply pending migrations to `DATABASE_URL`  |
| `pnpm db:studio`   | Browse the database in Drizzle Studio       |
| `pnpm verify`      | Everything CI runs, in one command          |

## Architecture

The app is organised by bounded context rather than by technical layer, so a
feature lives in one folder and its domain rules stay free of framework
concerns. Details and conventions are in [CLAUDE.md](./CLAUDE.md).

```
src/
├── app/                      Next.js routes, layouts and route handlers — thin
├── modules/
│   ├── github-insights/      PR and issue counts for followed repositories
│   ├── tasks/                the agentic task list
│   └── identity/             sign-in with GitHub (Better Auth)
└── shared/
    ├── domain/               Entity, AggregateRoot, ValueObject, Result, UniqueId
    ├── application/          Command/Query contracts and in-memory buses
    ├── infrastructure/       composition root, database client
    └── config/               zod-validated environment
```

Every module has the same four layers:

```
<context>/
├── domain/                   entities, value objects, domain events, repository ports
├── application/
│   ├── commands/             write use cases
│   ├── queries/              read use cases
│   └── ports/                outbound interfaces this context needs
├── infrastructure/           adapters implementing those ports
└── ui/                       React components for this context
```

Dependencies point inwards: `app` → `ui` → `application` → `domain`, and
`infrastructure` depends on `application` and `domain` but nothing depends on
`infrastructure`.

## Docs

Design and planning documents live in [docs/](./docs). Start with
[the repository table](./docs/ui/repository-table.md) for the screen being built
and the [implementation plan](./docs/implementation-plan.md) for how it maps onto
the contexts above.

## Keeping GitHub data fresh

Pages render from the database, never from GitHub, so a page view costs no
rate limit and still works while GitHub is down. The copy is refreshed by the
server, with the signed-in user's token, in two ways:

- **On a visit.** Once the page is on screen, rows last synced over an hour
  ago (or never) refresh on their own. The numbers stay visible, with a loader,
  until the new ones land.
- **Refresh.** The button in the header re-reads every watched repository,
  unless it was read in the last minute.

A sync is one GraphQL call per repository. Two tabs refreshing together make
one call, a failed sync keeps the last good numbers and says so on the row,
and a failure is not retried on its own for five minutes. The rules live in
`SyncState` in `src/modules/github-insights/domain/`.

## Configuration

Everything the app reads comes from plain environment variables, validated once
in `src/shared/config/env.ts`. See [.env.example](./.env.example) for the full
list; copy it to `.env.local` for development.

## Deployment

### Vercel (today)

Import the repository in Vercel. The defaults work: pnpm is detected from the
lockfile, `pnpm build` is the build command, and the App Router runs on the
Node.js runtime. Set the variables from `.env.example` under Settings →
Environment Variables, with `APP_URL` set to the production origin.

- **Database.** Any hosted Postgres works (Neon, Supabase, RDS, …); use its
  pooled connection string as `DATABASE_URL`. Apply migrations with
  `DATABASE_URL=… pnpm db:migrate` before deploying a change that adds one. The
  build does not run them.
- **GitHub OAuth app.** A second app for production, with the callback URL
  `https://<your-domain>/api/auth/callback/github`. Preview deployments have
  their own URLs and so cannot sign in through it.

### Moving to AWS later

The app is deliberately portable, so nothing here is Vercel-only: no
`@vercel/*` runtime packages, no Vercel KV or Blob, no Edge-runtime-only APIs,
and no configuration outside standard environment variables.

What would change:

- **Output mode.** Set `output: "standalone"` in `next.config.ts` and deploy
  the `.next/standalone` server behind ECS/Fargate or App Runner. That is a
  one-line change; it is left off for now because Vercel does not need it.
- **Images.** Next.js image optimisation is handled by Vercel today. On AWS,
  either run the built-in optimiser in the standalone server or point
  `images.loader` at CloudFront.
- **Caching and ISR.** The default filesystem cache is per-instance. With more
  than one instance, wire up a shared cache handler
  (`cacheHandler` in `next.config.ts`) backed by Redis or S3.
- **Secrets.** Environment variables come from Vercel today; on AWS they would
  come from SSM Parameter Store or Secrets Manager, injected as the same
  variable names.
- **Database.** RDS or Aurora Postgres, reached through the same
  `DATABASE_URL`: the app uses the plain `pg` driver, no vendor SDK. Each
  instance keeps its own pool (`pg`'s default of 10 connections), so size the
  database's connection limit, or put RDS Proxy in front, for the number of
  instances. Run `pnpm db:migrate` as a one-off task in the deploy pipeline.
- **Sign-in.** Point the production GitHub OAuth app's callback at the new
  origin and update `APP_URL`. Sessions and tokens live in Postgres, so they
  survive the move as long as `BETTER_AUTH_SECRET` stays the same.

## Working with Claude Code

`.claude/settings.json` registers Matt Pocock's
[skills marketplace](https://github.com/mattpocock/skills) for this project and
enables the `mattpocock-skills` plugin, so anyone who opens the repository in
Claude Code gets `/mattpocock-skills:to-spec`,
`/mattpocock-skills:to-tickets`, `/mattpocock-skills:implement` and the rest
without installing anything. Trust the folder when Claude Code asks, and the
plugin registers itself.

[CLAUDE.md](./CLAUDE.md) carries the layout and conventions an agent needs.

## License

[MIT](./LICENSE)
