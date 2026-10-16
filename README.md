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

GitHub is the only way to sign in, through a GitHub App you own. A GitHub App
rather than an OAuth app, because its access can be read-only and limited to
the repositories it is installed on; an OAuth app needs the `repo` scope,
"Full control of private repositories", to read a private repository at all.

1. Open [GitHub → Settings → Developer settings → GitHub Apps → New GitHub
   App](https://github.com/settings/apps/new).
2. **Homepage URL**: `http://localhost:3000`. **Callback URL**:
   `http://localhost:3000/api/auth/callback/github`. Both must match `APP_URL`.
   Keep **Expire user authorization tokens** ticked, and leave **Request user
   authorization (OAuth) during installation** unticked: sign-in starts from
   the app, which is what Better Auth checks the callback against.
3. **Setup URL** (optional): `http://localhost:3000/repositories`, with
   **Redirect on update** ticked, so installing on more repositories comes
   back to the dashboard.
4. **Webhook**: untick **Active**. The app does not take webhooks.
5. **Permissions**, all **Read-only**:
   - Repository: **Metadata** (GitHub requires it), **Pull requests**,
     **Issues**, **Checks**, **Commit statuses**.
   - Account: **Email addresses**, for the email every user needs.
6. **Where can this GitHub App be installed?** **Any account**, so
   organizations can install it too.
7. Create it, then **Generate a new client secret**. Put the **Client ID** and
   secret in `.env.local` as `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`, the
   app's URL name (the last part of `github.com/apps/<slug>`) as
   `GITHUB_APP_SLUG`, and set `BETTER_AUTH_SECRET` to the output of
   `openssl rand -base64 32`.
8. Install the app (**Install App** in its settings) on your account, and on
   any organization, choosing the repositories the dashboard should read.

Use one GitHub App for local development and a second one for production.

Sign-in sends no OAuth scopes: a GitHub App's user token carries the app's own
permissions, and the consent screen lists only those. The token reaches only
repositories the app is installed on, so **Add repositories** lists only those,
and links to the page that installs the app on more. An organization that does
not allow the app can still be watched by adding its repositories manually.
The token expires after eight hours and Better Auth refreshes it when it is
read; a refused refresh asks the user to sign in again.

### Scripts

| Script                 | What it does                                |
| ---------------------- | ------------------------------------------- |
| `pnpm dev`             | Dev server                                  |
| `pnpm build`           | Production build                            |
| `pnpm start`           | Serve the production build                  |
| `pnpm lint`            | ESLint (`lint:fix` to autofix)              |
| `pnpm typecheck`       | `tsc --noEmit`                              |
| `pnpm format`          | Prettier write (`format:check` to verify)   |
| `pnpm test`            | Vitest once (`test:watch`, `test:coverage`) |
| `pnpm db:generate`     | Write a migration from the schema changes   |
| `pnpm db:migrate`      | Apply pending migrations to `DATABASE_URL`  |
| `pnpm db:migrate:prod` | Apply them to RDS (a person at a terminal)  |
| `pnpm db:status:prod`  | List the migrations RDS has applied         |
| `pnpm db:studio`       | Browse the database in Drizzle Studio       |
| `pnpm verify`          | Everything CI runs, in one command          |

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

A failed sync shows GitHub's own message on the row and logs it on the server
as `[github] <code>: <message>`. A repository the GitHub App is not installed
on reads as not found, and its row says to install the app there. The app has
no organization permissions, so queries must not select `Team` fields, which
need the organization **Members** permission.

## Tasks for AI agents

Tasks are built for agents first. An agent connects to the MCP server at
`<APP_URL>/api/mcp` (Streamable HTTP, stateless) and reads and changes tasks
there: it takes the next ready task, claims it for a session, records
decisions and discoveries in the task's journal, ticks off acceptance criteria
and finishes with a handoff summary the next session reads first. Tasks can
have sub-tasks, block each other, and link to where they came from (a GitHub
issue or pull request, a Jira or Linear issue, any URL).

To connect Claude Code, sign in, open **Settings**, create a token under
**Agent access** and run the command it shows once:

```bash
claude mcp add --transport http fenro http://localhost:3000/api/mcp \
  --header "Authorization: Bearer fenro_pat_…"
```

Any MCP client that can send a bearer header works the same way. A token acts
as you on your tasks; give each agent its own, so its sessions show under its
name, and untick **Can change tasks** for one that should only read. Only a
hash of the secret is stored. The model and the tools are described in
[docs/tasks/agent-task-management.md](./docs/tasks/agent-task-management.md).

People work the same tasks on the **Tasks** screen: the list by view (ready, in
progress, blocked, closed), each task's brief and journal, and forms for
everything an agent can change. **New task here** on a repository and **Make a
task from this** on a pull request start a task already carrying where it came
from.

### Pictures on tasks

People and agents can add PNG, JPEG, WebP or GIF pictures (up to 4 MB each) to
a task: a design from a prototype, a screenshot of a bug. On the task page,
drop them on the Pictures section, paste them anywhere, or use **Add
pictures**; click one to see it large. Agents use the MCP tools
`attach_picture` and `get_picture`.

The files are kept in a private S3 bucket. Locally, `docker compose up -d`
starts an S3 stand-in (S3Mock) next to Postgres with the bucket already made,
and the `PICTURES_S3_*` values in `.env.example` point at it, so pictures work
as soon as you copy that file. Without `PICTURES_S3_BUCKET` everything else
works and the Pictures section says pictures are off.

Only the app touches the bucket. Uploads go through this app's server, and a
page loads a picture through `/api/pictures/<id>`, which checks it is yours
and sends the bytes itself. A picture never changes, so the browser keeps it
and asks once. In production the bucket comes from `terraform/s3.tf` and the
app reaches it with the App Runner instance role, so there are no access keys
([terraform/README.md](./terraform/README.md#pictures)).

## Configuration

Everything the app reads comes from plain environment variables, validated once
in `src/shared/config/env.ts`. See [.env.example](./.env.example) for the full
list; copy it to `.env.local` for development.

## Monitoring with Sentry

Errors, traces and logs go to Sentry when `SENTRY_DSN` is set; without it
nothing is sent. The SDK starts in `src/instrumentation.ts` (server and edge)
and `src/instrumentation-client.ts` (browser), with its settings in
`src/shared/infrastructure/observability/`.

- **Errors**: anything thrown while rendering, in a route handler or in a
  server action (`onRequestError`), uncaught browser errors, and the root
  error boundary (`src/app/global-error.tsx`).
- **Traces**: every request, with a span for each command and query on the
  buses (named by its type, such as `tasks.create`, with a refused command's
  code), each Postgres query, each call to GitHub, and each MCP request and
  tool call. `/api/health` and the event tunnel are never traced.
- **Logs**: `console.warn` and `console.error` on the server, and an info log
  for every refused command, each tied to the trace it happened in.
- **Replays**: only of browser sessions an error happened in, with text and
  pictures masked.

The browser sends its events to `/monitoring`, which forwards them to Sentry,
so ad blockers do not drop them. Cookies, request bodies and the
`Authorization` header are kept out of events. The DSN is public; the server
renders it into the page, so the image needs no build-time configuration.

The release workflow uploads source maps while building the image and tags
events with the commit, which needs the `SENTRY_ORG` and `SENTRY_PROJECT`
repository variables and the `SENTRY_AUTH_TOKEN` repository secret (see
`.github/workflows/release.yml`). On App Runner, `sentry_dsn` in
`terraform.tfvars` sets the DSN.

## Database

Every table lives in the `fenro` Postgres schema
(`src/shared/infrastructure/database/schema.ts`), and contexts declare tables
with `fenro.table(...)`, never `pgTable`. Drizzle's migration ledger sits in a
second schema, `fenro_migrations`. Neither touches `public` or `drizzle`, so
Fenro can share a database with another app: in production that is Flexi
Day's RDS instance, whose own tables (Better Auth's `user` and `session`
among them) and ledger live in exactly those two.

`scripts/db-migrate.sh` applies migrations, following Flexi Day's script of the
same name; its header documents every flag.

| Command                                      | Target                                          | Who runs it            |
| -------------------------------------------- | ----------------------------------------------- | ---------------------- |
| `pnpm db:migrate`                            | `DATABASE_URL` from the shell or `.env.local`   | anyone                 |
| `pnpm db:status:prod`                        | prints RDS's applied ledger, writes nothing     | anyone                 |
| `pnpm db:migrate:prod`                       | RDS, connection string from SSM Parameter Store | a person at a terminal |
| `DATABASE_URL=… ./scripts/db-migrate.sh url` | any other database, such as Neon                | a person at a terminal |

The production targets refuse to write unless stdin is a terminal, so an
agent's shell cannot apply DDL to a live database. `prod` reads the SecureString
parameter `/fenro/production/database-url` in `eu-central-1`, which Terraform
writes (override with `DB_PARAMETER` and `AWS_REGION`), and connects with `sslmode=verify-full`
against the RDS CA bundle, which it caches in `~/.cache/fenro`. It needs the
AWS CLI, `psql` and `curl`.

**The migration history was squashed** into `0000_baseline` when the tables
moved into `fenro`. A database migrated before that (tables in `public`, ledger
in `drizzle`, last migration `0008_task_skills`), such as Neon or an older
local one, is moved over once with `--adopt`: it moves the tables into `fenro`
and records the baseline, in one transaction, and refuses on any other
database. A plain migrate on such a database stops with a message that says
so.

Back up a production database first; it is the only write the move makes to
Neon:

```bash
./scripts/db-migrate.sh local --adopt                         # your docker compose database
pg_dump '<Neon direct string>' --format=custom --no-owner --no-privileges -f "neon-before-adopt-$(date +%Y%m%d-%H%M).dump"
DATABASE_URL='<Neon direct string>' ./scripts/db-migrate.sh url --adopt
```

**On RDS, Fenro has a role of its own.** `scripts/rds-create-fenro-role.sql`,
run once by the master user (Terraform's `database_bootstrap_command` output
runs it), creates `fenro`: it can create and own its two
schemas, cannot read or write Flexi Day's tables, is limited to 20
connections, and defaults its `search_path` to `fenro`. Fenro's
`DATABASE_URL` is then
`postgresql://fenro:<password>@<rds address>:5432/flexiday?sslmode=verify-full`,
and the app's container trusts the RDS CA through `NODE_EXTRA_CA_CERTS`.

## Deployment

### Vercel (today)

Import the repository in Vercel. `pnpm build` is the build command, the App
Router runs on the Node.js runtime, and Vercel takes the Node version from
`engines` in `package.json`. Set the variables from `.env.example` under
Settings → Environment Variables, with `APP_URL` set to the production origin.

- **pnpm.** Add `ENABLE_EXPERIMENTAL_COREPACK=1` as an environment variable.
  Without it Vercel picks its own pnpm from the lockfile version rather than
  the one pinned in `packageManager`.
- **Database.** Any hosted Postgres works (Neon, Supabase, RDS, …); use its
  pooled connection string as `DATABASE_URL`. Vercel's Neon integration sets
  that for you, alongside `DATABASE_URL_UNPOOLED`; the app ignores the other
  keys it adds. Apply migrations from your machine against the direct
  (unpooled) string, `DATABASE_URL=<direct string> ./scripts/db-migrate.sh url`,
  before deploying a change that adds one. The build does not run them.
- **Pictures.** Production keeps them in S3 now (see below). Vercel would
  need `PICTURES_S3_BUCKET` and an access key pair for it.
- **GitHub App.** A second app for production, set up as above with the
  callback URL `https://<your-domain>/api/auth/callback/github`, and its
  `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` and `GITHUB_APP_SLUG` set on
  Production.
- **Previews.** Preview deployments cannot sign in: GitHub sends sign-in back
  only to the callback URLs the GitHub App lists, and a preview's URL is new
  every time.

### Moving to AWS later

The app is deliberately portable, so nothing here is Vercel-only: no
`@vercel/*` runtime packages, no Vercel KV or Blob, no Edge-runtime-only APIs,
and no configuration outside standard environment variables.

What would change:

- **Output mode.** Done: `next.config.ts` builds `output: "standalone"`, and
  the `Dockerfile` runs that server. Vercel ignores the setting.
- **Images.** No page uses `next/image`, and `images.unoptimized` is on, so
  nothing depends on Vercel's optimiser. Turn it back on (the standalone
  server runs it) or point `images.loader` at CloudFront if that changes.
- **Caching and ISR.** The default filesystem cache is per-instance. With more
  than one instance, wire up a shared cache handler
  (`cacheHandler` in `next.config.ts`) backed by Redis or S3.
- **Secrets.** Environment variables come from Vercel today; on AWS they would
  come from SSM Parameter Store or Secrets Manager, injected as the same
  variable names.
- **Database.** Flexi Day's RDS Postgres, in Fenro's own schema; see
  [Database](#database). Each instance keeps its own pool (`pg`'s default of
  10 connections) under the `fenro` role's limit of 20.
- **Pictures.** Done: an S3 adapter for the `PictureStorage` port
  (`src/modules/tasks/infrastructure/s3-picture.storage.ts`), the bucket in
  `terraform/s3.tf`, and `scripts/copy-pictures-to-s3.sh` to bring the
  UploadThing pictures over.
- **Sign-in.** Point the production GitHub App's callback at the new
  origin and update `APP_URL`. Sessions and tokens live in Postgres, so they
  survive the move as long as `BETTER_AUTH_SECRET` stays the same.

### AWS App Runner

The `Dockerfile` builds the standalone server on Node 24 (`node:24-alpine`,
non-root, about 74 MB compressed). It holds no configuration: every variable
in `.env.example` is read when the container starts. It listens on port 3000,
answers `/api/health`, and trusts Amazon's RDS certificate authority, so a
`DATABASE_URL` ending in `?sslmode=verify-full` verifies RDS.

```bash
docker build -t fenro-dashboard .
docker run --rm -p 3000:3000 --env-file .env.local fenro-dashboard
```

`.github/workflows/release.yml` ships `main`. When CI passes on a push to
`main`, it builds the image, pushes it to ECR as `:<commit sha>` and
`:latest`, starts an App Runner deployment of `:latest`, and fails if App
Runner rolls it back. Run it from the Actions tab to redeploy by hand. It
signs in to AWS through GitHub's OIDC provider and needs these repository
variables (Settings → Secrets and variables → Actions → Variables), all of
which Terraform outputs:

| Variable                 | Value                                                                             |
| ------------------------ | --------------------------------------------------------------------------------- |
| `AWS_REGION`             | The region of the ECR repository and the service                                  |
| `AWS_ROLE_ARN`           | The deploy role; it trusts `repo:Daniel88dev/fenro-dashboard:ref:refs/heads/main` |
| `ECR_REPOSITORY`         | The ECR repository name                                                           |
| `APP_RUNNER_SERVICE_ARN` | The service; without it the release fails after pushing the image                 |

The deploy role needs ECR push to that repository (`ecr:GetAuthorizationToken`,
`ecr:BatchCheckLayerAvailability`, `ecr:InitiateLayerUpload`,
`ecr:UploadLayerPart`, `ecr:CompleteLayerUpload`, `ecr:PutImage`,
`ecr:BatchGetImage`) and `apprunner:StartDeployment` and
`apprunner:ListOperations` on the service. The service watches the `latest`
tag with automatic deployments **off**, because the workflow starts each
deployment itself and would otherwise collide with App Runner's own.

Migrations are not part of the release, as on flexi-day-be: apply them by
hand with `pnpm db:migrate:prod` (see [Database](#database)) before merging a
change that adds one, and keep each
migration compatible with the code already running, since the merge deploys
on its own.

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
