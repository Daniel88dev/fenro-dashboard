# Next.js 16 rendering and data strategy

Type: research
Status: resolved
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

## Answer

Resolved 2026-09-20. Full findings:
[`docs/research/nextjs-16-rendering-strategy.md`](../../../docs/research/nextjs-16-rendering-strategy.md)
— verified against the vendored docs of the installed `next@16.3.5` and, where a
doc claim was load-bearing, against the shipped `.d.ts` and runtime JS.

**The strategy.** Enable `cacheComponents: true` — a top-level, non-experimental
flag in 16.3.5 that turns on `use cache` / `cacheLife` / `cacheTag` and makes PPR
the default. Render as a static shell (the page) → one `<Suspense>` per row's
counts → a nested `<Suspense>` per expanded detail. The page component stays
synchronous and never awaits `searchParams`; it passes the promise down, because
awaiting it at the top makes everything below dynamic and unprerenderable.

**Expansion state goes in the URL**, as a repeatable `?open=owner/repo` param. A
`searchParams` change is a client-side transition: the layout stays mounted, only
the page segment re-renders, and rows whose cache entries are still fresh come
back from cache — so widening the selection costs one GitHub read, not N. With
several rows open, each detail is a sibling Suspense boundary streaming
independently, which is the strongest argument for rendering this on the server.
The missing piece people get wrong is pending feedback: `router.push` inside
`startTransition` plus `useOptimistic` to dim the row rather than blank it.

**Rejected, with reasons.** Server Actions for the reads — Next dispatches them
one at a time per client, so several expanded rows would serialize. Client
components calling Route Handlers as the primary path — an extra HTTP round trip
and no prerendering; that pattern is for polled data, if we add polling later.

**Verified API changes that will bite** (each confirmed in the installed package,
not just the prose): `revalidateTag(tag, profile)` now takes a **required** second
argument; `cacheTag`/`cacheLife` are stable and un-prefixed but **throw at
runtime** without `cacheComponents`; `params`/`searchParams`/`cookies()`/
`headers()` are Promise-only; `experimental.ppr` and `experimental.dynamicIO` are
gone, folded into `cacheComponents`; `middleware.ts` is deprecated in favour of
`proxy.ts`; `next lint` is removed. New: `updateTag`, `refresh`, `io()`.

**Five things that bite the CQRS layering**, which is why this ticket mattered
more than it looked:

1. **`React.cache` is isolated inside every `use cache` scope.** The idiomatic
   request-scoped composition root — `cache(() => buildContainer())` — silently
   stops being shared the moment it is called inside a cached function. Each
   cached query then gets its own container and its own dedup: correct results,
   quietly duplicated GitHub calls, on a rate-limited API. Keep `'use cache'` at
   the _query handler_ level, below the bus, and pass plain arguments in.
2. **Domain objects cannot cross a `use cache` boundary.** Class instances are
   unsupported in RSC serialization, so `Entity`, `AggregateRoot`, `ValueObject`
   and `UniqueId` can never be arguments to or returns from a cached function,
   nor props to a client component. Query handlers must return plain read-model
   DTOs — which is what the conventions already require; the framework now
   enforces it. Corollary: `Result<T, Error>` is unproven across that boundary
   because `Error` is a class instance; prefer `Result<T, {code, message}>`.
3. **The request-API restriction follows the call stack.** An adapter that reaches
   for `headers()` — or calls a helper that does — fails with
   `next-request-in-use-cache` when invoked from a cached handler, and on a
   dynamic route that can pass `next build` and fail under `next start`. Read the
   token above the cached scope and pass it as an argument.
4. **Cache keys capture closure variables automatically.** A cached read closing
   over a per-user token becomes a per-user cache entry with near-zero hit rate.
   Cache on the low-cardinality dimension (repository id) and filter in memory.
5. **`use cache` cannot be applied to a Route Handler's `GET` export** — it has to
   be a helper. That helper _is_ the query handler, which fits the repo's
   "route handlers stay thin" rule exactly.

**Portability.** Everything recommended is explicitly supported on a self-hosted
Node container, but the README's AWS section is incomplete for Next 16: it
predates `cacheHandlers` (plural) and `refreshTags()` for cross-instance tag
invalidation, the `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` that must be set at build
time and identical across instances, `deploymentId` for version-skew protection,
and the fact that an AWS ALB may buffer responses and silently defeat streaming.

**One finding that graduates into fog:** no `use cache` entry survives a deploy,
because the build id is part of the cache key. On a rate-limited API with frequent
deploys, the first visitor after each deploy pays full cost for every visible row.
That pushes toward owning the GitHub response cache in `infrastructure/` and
letting `use cache` be purely a render concern — which is ticket 05's decision to
make, and the strongest argument yet for the snapshot side of it.
