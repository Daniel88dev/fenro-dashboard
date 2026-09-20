# Next.js 16 rendering and data strategy

Type: research
Status: claimed
Blocked by: —
Part of: [map](../map.md)

## Question

What is the right rendering and data strategy for this screen in **Next.js 16**
specifically, expressed in this version's APIs rather than remembered ones?

- How the table shell, the counts and the expanded detail should each be
  rendered: server components with Suspense streaming, client components calling
  route handlers, or server actions.
- What caching and revalidation look like in 16.3.5 — what changed around `fetch`
  caching, `unstable_cache`, `revalidateTag`, `"use cache"`/`cacheLife`/`cacheTag`
  and `after()`, and which of those are stable versus behind a flag.
- Whether expansion state belongs in `searchParams` or in client state, and what
  a `searchParams` change costs in this version when several rows are expanded.
- For every mechanism recommended: does it work on a self-hosted Node container,
  and what has to be configured (`output: "standalone"`, a shared `cacheHandler`)?
- Anything in Next 16 that would bite the CQRS layering — request-scoped
  composition, module-level singletons shared across requests, `React.cache`.

`AGENTS.md` is explicit that this Next.js differs from training data, so the
answer must cite the vendored docs under `node_modules/next/dist/docs/`.

The answer feeds tickets 05 and 10.
