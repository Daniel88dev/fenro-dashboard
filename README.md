# Fenro Dashboard

An advanced GitHub dashboard for the repositories you care about — open pull
requests and issues at a glance — and, in the same app, an agentic task list
that carries context from one session to the next.

This repository is currently the scaffold: the architecture, tooling and CI are
in place, no features are built yet.

## Stack

| Concern    | Choice                                               |
| ---------- | ---------------------------------------------------- |
| Framework  | Next.js 16 (App Router, Turbopack) on React 19       |
| Language   | TypeScript, `strict`                                 |
| Styling    | Tailwind CSS v4                                      |
| Validation | Zod                                                  |
| Tests      | Vitest + Testing Library (jsdom)                     |
| Lint       | ESLint (`eslint-config-next`) + Prettier             |
| Packages   | pnpm, lockfile committed                             |
| CI         | GitHub Actions on pull requests and pushes to `main` |

## Getting started

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

The app runs at http://localhost:3000, and `GET /api/health` is a liveness
probe.

### Scripts

| Script           | What it does                                |
| ---------------- | ------------------------------------------- |
| `pnpm dev`       | Dev server                                  |
| `pnpm build`     | Production build                            |
| `pnpm start`     | Serve the production build                  |
| `pnpm lint`      | ESLint (`lint:fix` to autofix)              |
| `pnpm typecheck` | `tsc --noEmit`                              |
| `pnpm format`    | Prettier write (`format:check` to verify)   |
| `pnpm test`      | Vitest once (`test:watch`, `test:coverage`) |
| `pnpm verify`    | Everything CI runs, in one command          |

## Architecture

The app is organised by bounded context rather than by technical layer, so a
feature lives in one folder and its domain rules stay free of framework
concerns. Details and conventions are in [CLAUDE.md](./CLAUDE.md).

```
src/
├── app/                      Next.js routes, layouts and route handlers — thin
├── modules/
│   ├── github-insights/      PR and issue counts for followed repositories
│   └── tasks/                the agentic task list
└── shared/
    ├── domain/               Entity, AggregateRoot, ValueObject, Result, UniqueId
    ├── application/          Command/Query contracts and in-memory buses
    ├── infrastructure/       cross-cutting adapters
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

## Configuration

Everything the app reads comes from plain environment variables, validated once
in `src/shared/config/env.ts`. See [.env.example](./.env.example) for the full
list; copy it to `.env.local` for development.

## Deployment

### Vercel (today)

Import the repository in Vercel. The defaults work: pnpm is detected from the
lockfile, `pnpm build` is the build command, and the App Router runs on the
Node.js runtime. Set the variables from `.env.example` under Settings →
Environment Variables.

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
