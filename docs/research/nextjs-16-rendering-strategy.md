# Next.js 16 rendering and data strategy for the watched-repositories table

Research ticket findings. Verified against the **vendored docs of the exact installed version**,
`next@16.3.5` (`node_modules/next/package.json`), plus the shipped
`.d.ts` and runtime files where a doc claim needed confirming. Vendored docs root:
`node_modules/next/dist/docs/`.

Where a claim could not be verified from the vendored docs it is marked **[UNVERIFIED]**.

---

## Bottom line

- **Enable `cacheComponents: true`** in `next.config.ts`. It is a top-level (non-experimental),
  stable flag in 16.3.5 that turns on `use cache` / `cacheLife` / `cacheTag` / `use cache: remote`
  and makes PPR the default. Without it those APIs **throw at runtime** (verified in the shipped
  JS). It is opt-in: the repo's current empty `next.config.ts` has none of it.
- **Render it as: static shell (page) → `<Suspense>` per row-count → `<Suspense>` per expanded
  detail.** The page component stays synchronous and never awaits `searchParams`; it passes the
  `searchParams` promise down. All GitHub reads live in `'use cache'`-marked query functions with
  an explicit `cacheLife` and a per-repo `cacheTag`.
- **Do not use Server Actions for the reads.** Next dispatches Server Actions **one at a time per
  client**; with several rows expanded at once they would serialize. Do not use client components
  fetching Route Handlers for the primary path either: that is an extra HTTP round trip and cannot
  prerender.
- **Expansion state goes in the URL (`searchParams`), as a repeatable key** (`?open=owner/repo`).
  Cost in 16: a searchParams change is a client-side transition that re-renders only the page
  segment, keeps the layout mounted, and streams each newly expanded row's Suspense boundary
  independently. Already-expanded rows whose `use cache` entries are still fresh come back from
  cache, so widening the selection costs one GitHub read, not N.
- **Portability is fine, but not free.** Everything recommended works on a self-hosted Node
  container (the vendored docs state this explicitly for `use cache`, `use cache: remote`,
  `cacheHandlers` and `after`). Moving to AWS needs `output: "standalone"`, plus — the moment there
  is more than one instance — a `cacheHandlers.remote` handler with `refreshTags()`,
  `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, `deploymentId`, and proxy buffering disabled so streaming
  actually streams.

---

## 1. How to render the shell, the counts, and the expanded detail

### Recommended shape

| Piece                                            | Rendering                                                                   | API                                                                                    |
| ------------------------------------------------ | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Table shell (header, row chrome, the repo names) | Server Component, prerendered into the **static shell**                     | plain async/sync server component, `'use cache'` on the "which repos are watched" read |
| The counts (PRs / Issues / Tasks per row)        | Server Component **inside its own `<Suspense>`**, streamed                  | `'use cache'` + `cacheLife` + `cacheTag` on the query fn                               |
| Expanded detail (list of open PRs)               | Server Component inside a **nested `<Suspense>`**, keyed off `searchParams` | same, per-repo cache tag                                                               |
| Individual CI checks for one PR                  | Server Component inside a further nested `<Suspense>`                       | same, per-PR cache tag                                                                 |
| The expand/collapse click itself                 | Client Component that only does `router.push` inside a transition           | `useRouter` + `useSearchParams` + `useOptimistic`/`useTransition`                      |

Sibling `<Suspense>` boundaries stream independently, in whatever order their work resolves; nested
boundaries give a progressive reveal (outer resolves → inner fallback becomes visible). Both
patterns are documented with code in
`node_modules/next/dist/docs/01-app/02-guides/streaming.md` §"Parallel streaming with sibling
boundaries" (line 121) and §"Nested boundaries for progressive detail" (line 179).

The page component must **not** `await` `searchParams` at the top. From
`01-app/02-guides/streaming.md` §"Push dynamic access down" (line 243):

> "If you `await` any of these at the top of a layout or page, everything below that point becomes
> dynamic and cannot be prerendered as part of the static shell."

Pass the promise through instead (`01-app/02-guides/migrating-to-cache-components.md` §"`cookies`,
`headers`, and `searchParams`", line 683):

```tsx
export default function Page({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <RepoTable searchParams={searchParams} />
    </Suspense>
  );
}
```

`01-app/01-getting-started/08-caching.md` §"Maximizing the static shell" shows the same trick for
`params` using an inline `params.then(...)` in JSX to keep the page synchronous.

### Why not Server Actions for the reads

`01-app/02-guides/server-actions.md` §"Sequential dispatch on the client" (line 26-30):

> "Next.js dispatches Server Actions one at a time per client. If a user triggers three actions in
> quick succession, the second waits for the first to finish, then the third waits for the second.
> … do not rely on `Promise.all` to parallelize Server Actions from the client. If you need parallel
> work, do it inside a single Server Action, fetch in parallel from a Server Component, or use a
> Route Handler for non-mutation requests."

`01-app/02-guides/backend-for-frontend.md` §"Caveats → Server Actions" (line 898) repeats it:
"Server Actions are queued. Using them for data fetching introduces sequential execution."

This is decisive for this screen: "several rows may be expanded at once" is exactly the case that
Server Actions serialize.

### Why not client components fetching Route Handlers (as the primary path)

`01-app/02-guides/backend-for-frontend.md` §"Caveats → Server Components" (line 877):

> "Fetch data in Server Components directly from its source, not via Route Handlers. For Server
> Components prerendered at build time, using Route Handlers will fail the build step … For Server
> Components rendered on demand, fetching from Route Handlers is slower due to the extra HTTP round
> trip between the handler and the render process."

The same doc lists the legitimate cases for client-side fetching: client-only Web APIs and
**frequently polled data**. If this dashboard later grows a "refresh every 60s" behaviour, that is
the one place a Route Handler + SWR/TanStack Query is the right answer
(`01-app/02-guides/client-side-data-fetching/`). It is not the right answer for first paint.

### Renamed / removed / changed versus Next 14 and 15

From `01-app/02-guides/upgrading/version-16.md`, cross-checked against the shipped `.d.ts`:

| Next 14/15                                                                                 | Next 16.3.5                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `params`, `searchParams`, `cookies()`, `headers()`, `draftMode()` accessible synchronously | **Sync access fully removed.** All are Promises / async. §"Async Request APIs (Breaking change)", line 281                                                                                                                                                                                                           |
| `experimental.ppr`, route-level `experimental_ppr`                                         | **Removed.** Replaced by top-level `cacheComponents: true`. §"Partial Prerendering (PPR)", line 582                                                                                                                                                                                                                  |
| `experimental.dynamicIO`, `experimental.useCache`                                          | **Merged into `cacheComponents`.** §"`experimental.dynamicIO` and `experimental.useCache`", line 1200. (Config normalization confirms: `dist/server/config.js:1242` sets `experimental.useCache = result.cacheComponents` when unset, and line 1224 throws if you disable `useCache` while `cacheComponents` is on.) |
| `unstable_cacheLife`, `unstable_cacheTag`                                                  | **Stable as `cacheLife`, `cacheTag`.** Aliases retained (`next/cache.d.ts` still exports `unstable_cacheLife`/`unstable_cacheTag`). §"cacheLife and cacheTag", line 550                                                                                                                                              |
| `revalidateTag(tag)`                                                                       | **`revalidateTag(tag, profile)` — second arg required.** Confirmed in `dist/server/web/spec-extension/revalidate.d.ts`: `revalidateTag(tag: string, profile: string \| CacheLifeConfig): undefined` — `profile` is not optional. One-arg form is deprecated and TS-errors. §"revalidateTag", line 442                |
| (nothing)                                                                                  | **`updateTag(tag)`** — new, Server-Actions-only, read-your-own-writes. §"updateTag", line 480                                                                                                                                                                                                                        |
| (nothing)                                                                                  | **`refresh()`** — new, Server-Actions-only, refreshes the client router. §"refresh", line 516                                                                                                                                                                                                                        |
| (nothing)                                                                                  | **`io()`** from `next/cache` — new; mark a sync non-deterministic read so it suspends during prerender. `01-app/03-api-reference/04-functions/io.md`                                                                                                                                                                 |
| `middleware.ts` / `export function middleware`                                             | **Deprecated, renamed `proxy.ts` / `export function proxy`.** `skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize`. §"`middleware` to `proxy`", line 612                                                                                                                                                           |
| `next lint`                                                                                | **Removed.** §"`next lint` Command", line 1082                                                                                                                                                                                                                                                                       |
| `runtime = 'edge'`                                                                         | Deprecated; Cache Components **requires the Node.js runtime** (`cacheComponents.md`)                                                                                                                                                                                                                                 |
| (nothing)                                                                                  | **`instant` route segment config** — new, `cacheComponents`-only escape hatch, `export const instant = false` (`03-api-reference/03-file-conventions/02-route-segment-config/instant.md`)                                                                                                                            |

Also relevant and new: with `cacheComponents` on, Next wraps routes in React's `<Activity>` and
**preserves component state across navigations** instead of unmounting
(`cacheComponents.md` §"Navigation with Activity"; `01-app/02-guides/preserving-ui-state.md`).
For this screen that is a _benefit_ if expansion state were client-held, and a non-issue if it is
in the URL — but see §3 for the interaction.

---

## 2. Caching and revalidation as Next 16.3.5 actually is

### Stability, and what needs a flag

| API                                         | Import           | Stable in 16.3.5?                                        | Needs `cacheComponents: true`?            |
| ------------------------------------------- | ---------------- | -------------------------------------------------------- | ----------------------------------------- |
| `'use cache'`                               | directive        | Yes (v16.0.0)                                            | **Yes**                                   |
| `'use cache: remote'`                       | directive        | Yes (v16.0.0)                                            | **Yes**                                   |
| `'use cache: private'`                      | directive        | Yes (v16.0.0)                                            | **Yes**                                   |
| `cacheLife`                                 | `next/cache`     | **Yes** (un-prefixed)                                    | **Yes**                                   |
| `cacheTag`                                  | `next/cache`     | **Yes** (un-prefixed)                                    | **Yes**                                   |
| `revalidateTag(tag, profile)`               | `next/cache`     | Yes                                                      | No                                        |
| `updateTag(tag)`                            | `next/cache`     | Yes                                                      | No (works with the previous model too)    |
| `refresh()`                                 | `next/cache`     | Yes                                                      | No                                        |
| `revalidatePath(path, type?)`               | `next/cache`     | Yes, unchanged                                           | No                                        |
| `after()`                                   | `next/server`    | Yes                                                      | No                                        |
| `connection()`                              | `next/server`    | Yes                                                      | No                                        |
| `io()`                                      | `next/cache`     | Yes                                                      | No-op without it                          |
| `unstable_cache`                            | `next/cache`     | Still `unstable_`, **superseded**                        | No                                        |
| `unstable_noStore`                          | `next/cache`     | Still `unstable_`, **not needed** under Cache Components | No                                        |
| `cacheHandlers` (config)                    | `next.config.ts` | Yes, top-level (v16.0.0)                                 | Used by `use cache` / `use cache: remote` |
| `cacheHandler` (config, the ISR/page cache) | `next.config.ts` | Yes, top-level                                           | No                                        |
| `partialPrefetching` (config)               | `next.config.ts` | Yes, top-level (v16.3.0)                                 | **Yes — build throws without it**         |
| `experimental.staleTimes`                   | `next.config.ts` | **Still experimental**                                   | No                                        |
| `reactCompiler` (config)                    | `next.config.ts` | Stable in 16, **off by default**                         | No                                        |

Verified directly, not just from prose: `next/cache.d.ts` exports `cacheTag`, `cacheLife`,
`revalidatePath`, `revalidateTag`, `updateTag`, `refresh`, `unstable_cache`, `unstable_noStore`,
`io`, and keeps `unstable_cacheLife`/`unstable_cacheTag` as aliases.
`dist/server/use-cache/cache-tag.js:15` and `dist/server/use-cache/cache-life.js:16` throw
`` `cacheTag()` is only available with the `cacheComponents` config. `` (error codes E886/E885) when
the flag is off, and `cache-tag.js` additionally throws E819 if called outside a `use cache` scope.
`dist/server/config-shared.d.ts:1538` has `cacheComponents?: boolean` at top level with
`cacheComponents: false` in the defaults (line 1678); `partialPrefetching?: boolean |
'unstable_eager'` at line 1553.

### What changed around `fetch` defaults

`fetch` is **not cached by default** — and this is now the stated default in both models, not a
Next-15-only quirk. `01-app/01-getting-started/06-fetching-data.md`:

> "`fetch` requests are not cached by default and will block the page from rendering until the
> request is complete. Use the `use cache` directive to cache results, or wrap the fetching
> component in `<Suspense>` to stream fresh data at request time."

Identical `fetch` calls are still **memoized within one render pass**
(`01-app/02-guides/caching-without-cache-components.md` §"Deduplicating requests"). That is
per-request dedup, not a cache.

Route Handlers: **not cached by default**; `export const dynamic = 'force-static'` is the old opt-in.
Under Cache Components that changes — `GET` handlers "follow the same model as pages: they prerender
when they don't access uncached or runtime data, and you cache uncached data with `use cache`"
(`01-app/02-guides/migrating-to-cache-components.md` line 783). Important mechanical detail from
`01-app/01-getting-started/15-route-handlers.md`:

> "`use cache` cannot be used directly inside a Route Handler body; extract it to a helper function."

That fits the repo's "route handlers stay thin" rule exactly — the cached helper _is_ the query
handler.

### `unstable_cache` → `use cache`

`01-app/03-api-reference/04-functions/unstable_cache.md` opens with:

> "**Note:** This API has been replaced by `use cache` in Next.js 16. We recommend opting into Cache
> Components and replacing `unstable_cache` with the `use cache` directive."

The migration mapping (`migrating-to-cache-components.md` line 376): the key-parts array goes away
(the key is derived from arguments), `options.revalidate` → `cacheLife`, `options.tags` →
`cacheTag`.

**One real reason to keep `unstable_cache` exists**, and it matters here: persistence across
deploys.

> "Like the `fetch` Data Cache, `unstable_cache` persists cached values across deployments and
> serverless instances, while `use cache` does not." — `migrating-to-cache-components.md`, line ~430

and from `01-app/03-api-reference/01-directives/use-cache-remote.md` §"Persistence across deploys":

> "Remote cache entries do not persist across deploys. The cache key includes the `deploymentId`
> (when configured) or the `buildId` … If you need entries that persist across deploys, use
> `unstable_cache` for non-`fetch` functions, or rely on the `fetch` cache."

For a rate-limited GitHub API this is a genuine trade-off: **every deploy cold-starts the GitHub
cache**, and the first visitor after a deploy pays full rate-limit cost for every visible row. See
"Open questions" below.

### `cacheLife` profiles (exact numbers, from `next/cache.d.ts` JSDoc and `cacheLife.md`)

| Profile   | `stale` | `revalidate` | `expire` |
| --------- | ------- | ------------ | -------- |
| `default` | 5 min   | 15 min       | never    |
| `seconds` | 30 s    | 1 s          | 1 min    |
| `minutes` | 5 min   | 1 min        | 1 h      |
| `hours`   | 5 min   | 1 h          | 1 day    |
| `days`    | 5 min   | 1 day        | 1 week   |
| `weeks`   | 5 min   | 1 week       | 30 days  |
| `max`     | 5 min   | 30 days      | 1 year   |

Prerendering thresholds that will bite if you reach for `seconds`
(`cacheLife.md` §"Prerendering behavior", line 262):

- `revalidate: 0`, or `expire` under 5 minutes → **excluded from prerenders**, becomes a dynamic hole.
- `stale` under 30 s → excluded from prerenders (a prefetch would expire before the click).
- `stale` ≥ 30 s but < 5 min → in prerenders, but **excluded from the App Shell**.
- Of the presets, only `seconds` trips any of these (its 1-minute `expire`).

Client side, `cacheLife.md` §"Client cache behavior" (line 248): the `stale` value is sent as the
`x-nextjs-stale-time` header, and **a 30-second minimum is enforced** by the client router
regardless of configuration. Also: "When you call revalidation functions from a Server Action
(`revalidateTag`, `revalidatePath`, `updateTag`, or `refresh`), the entire client cache is
immediately cleared, bypassing the stale time."

`cacheLife()` cannot be called at module scope — it throws (`cacheLife.md` line 44).

**Recommendation for this screen:** `cacheLife('minutes')` (5 min stale / 1 min revalidate / 1 h
expire) on the counts and on the PR lists. It stays above every prerender threshold, and the 1-minute
background revalidate is about right for a GitHub dashboard that is slow-ish and rate-limited.

### `revalidateTag` vs `updateTag` vs `refresh` vs `revalidatePath`

From `01-app/02-guides/server-actions.md` §"Choosing a cache update" (line 141) and the individual
API refs:

- **`updateTag(tag)`** — Server Actions only, throws elsewhere. Expires the tag immediately; the
  route re-render that ships with the action's response **waits for fresh data**. Read-your-own-writes.
- **`revalidateTag(tag, profile)`** — Server Actions _and_ Route Handlers. Stale-while-revalidate.
  `'max'` is the recommended profile ("a one year window, long enough that requests are always
  served stale content while the revalidation runs"). `{ expire: 0 }` means no stale is ever served
  (blocking revalidate) — use that in a webhook Route Handler where `updateTag` is unavailable.
  Crucially: "A revalidation is triggered by a request, not by the `revalidateTag` call, so pages
  using the tag revalidate as they are visited rather than all at once."
- **`refresh()`** — Server Actions only. Re-renders the current route's RSC payload **without**
  invalidating cached entries. Use it when the view depends on state outside the cache.
- **`revalidatePath(path, type?)`** — unchanged from the previous model. Self-hosting doc notes it
  is "a convenience layer on top of cache tags" implemented via soft tags.

Behaviour difference worth writing down: `updateTag`, `revalidatePath` and `refresh` each cause Next
to re-render the route server-side and ship a fresh RSC payload **in the action's own response**;
`revalidateTag` with a SWR profile "intentionally skips that immediate re-render".

**For this screen:** a "Refresh this repo now" button is a Server Action that calls
`updateTag(\`repo-${owner}/${name}\`)`. A GitHub webhook hitting a Route Handler calls
`revalidateTag(\`repo-${id}\`, 'max')`. Tag scheme: `cacheTag('repos', \`repo-${id}\`,
\`repo-${id}-prs\`, \`pr-${prId}-checks\`)`, so a webhook for one PR invalidates one PR's checks and
nothing else.

### Tag limits

`revalidateTag.md`: tags are **case-sensitive and must not exceed 256 characters**, and — the
dangerous part — "A tag that exceeds the limit is never assigned to cached data, so revalidating it
does nothing." Silent failure. Keep tags short; `owner/repo` slugs are fine, arbitrary PR titles are
not.

### `after()`

`01-app/03-api-reference/04-functions/after.md`. Available in Server Components (including
`generateMetadata`), Server Functions, Route Handlers and Proxy. Key facts:

- "`after` is **not** a Request-time API and calling it does not cause a route to become dynamic. If
  it's used within a static page, the callback will execute at build time, or whenever a page is
  revalidated."
- Runs even when the response failed, or `notFound()`/`redirect()` was called.
- **In Server Components (pages and layouts) you cannot use `cookies`, `headers`, or other
  Request-time APIs inside `after`** — only in Route Handlers and Server Functions. Reason given:
  `after` runs after React's rendering lifecycle, and Next needs to know which part of the tree
  touched request data to support PPR.
- Duration is bounded by the route's max duration / `maxDuration` segment config.

Good fit here: recording GitHub rate-limit headers, or logging how long a repo read took, without
adding latency to the row.

---

## 3. URL (`searchParams`) vs client state for expansion

**Recommendation: the URL**, as a repeatable param — `?open=vercel/next.js&open=facebook/react`.

### What a searchParams change costs in this version

- `searchParams` is a **Request-time API**. `03-api-reference/03-file-conventions/page.md`: "Using
  it will opt the page into dynamic rendering at request time." Under Cache Components the blast
  radius is narrowed to **where you access it**: "where you access `searchParams` in the component
  tree determines how much of the page can be prerendered."
- Changing it via `router.push` is a **client-side transition**, not a page load
  (`01-getting-started/04-linking-and-navigating.md` §"Client-side transitions", line 152): shared
  layouts stay mounted and interactive, only the page segment is replaced, and the transition is
  interruptible. `staleTimes.md` confirms "shared layouts won't automatically be refetched on every
  navigation, only the page segment that changes."
- The new page render re-enters the tree. Rows whose `'use cache'` entries are still within
  `revalidate` come back from cache without touching GitHub. **Only the newly expanded row does real
  work**, and it does that work behind its own `<Suspense>` boundary, so the rest of the table never
  blanks.
- With several rows expanded, each expanded detail is a **sibling Suspense boundary**, so they stream
  independently and in completion order (`streaming.md` line 121). This is the single biggest reason
  to prefer server rendering over client fetching for this screen: N expanded rows = N parallel
  server reads in one render pass, versus N sequential Server Actions or N client round trips.

### The pending-feedback pattern (this is the bit people get wrong)

`router.push()` alone gives no local pending state, so the chevron keeps rendering the old URL until
the server render lands. `01-app/02-guides/interactive-apps.md` §"Step 3: Filter with pending
feedback" (line 179) gives the exact remedy, and it transfers to expand/collapse verbatim:

- The client component that owns the URL update calls `router.push` inside `startTransition`.
- `useOptimistic(value)` renders the _intended_ expanded state on the click frame.
- A second `useOptimistic(false)` drives a `data-pending` attribute, which ancestors style through
  CSS `:has()` (`group-has-data-pending:opacity-50`) to dim the row while the server render loads,
  without replacing it with a skeleton.
- Props that take a navigation callback are named `…Action` by convention.

The guide adds a caution directly relevant to a table: `:has()` re-evaluates the anchored subtree
whenever `data-pending` toggles, which is cheap for a per-row toggle but not for high-frequency
interactions.

### Cost of the client-state alternative

Cheaper per click (no server round trip to change which rows are open) but you pay elsewhere:

- The detail data still has to come from somewhere, and the only client-side routes to it are Server
  Actions (**serialized**, §1) or Route Handlers (**extra round trip**, no prerender, and the data
  layer gets duplicated as a JSON API).
- No deep link, no shareable "here's the three repos that are on fire" URL, no back-button.
- You would need `useSearchParams`-free client components wrapped in `<Suspense>` anyway if any part
  of them reads the URL — `use-search-params.md` line 82: "If a route is prerendered, calling
  `useSearchParams` will cause the Client Component tree up to the closest `Suspense` boundary to be
  client-side rendered", and line 181: a production build **fails** if a static page calls
  `useSearchParams` outside a Suspense boundary.

### The Activity interaction (only if you go client-state)

With `cacheComponents` on, Next keeps up to **3 recently visited routes** mounted-but-hidden via
React `<Activity>` rather than unmounting them (`cacheComponents.md`;
`02-guides/preserving-ui-state.md`). Client-held expansion state therefore **survives navigating
away and back** — which the preserving-ui-state guide calls out as desirable for "a filters panel …
the user set up their view intentionally", and undesirable for transient popovers (reset those in a
`useLayoutEffect` cleanup). URL-held state gets this for free and unambiguously.

### Prefetching note

If you later add `partialPrefetching: true` (16.3.0+, requires `cacheComponents`), the default
`<Link>` prefetch fetches a **URL-independent App Shell** — it will _not_ include anything that
depends on `searchParams`. To have an expanded row's content prefetched, the link must be
`<Link prefetch={true}>`, which "costs a server invocation per prefetchable link"
(`01-getting-started/08-caching.md` §"Prefetching"; `partialPrefetching.md`). For a rate-limited
GitHub API, be deliberate about this: don't put `prefetch={true}` on every row.

---

## 4. Portability to a self-hosted Node container on AWS

Primary source: `01-app/02-guides/self-hosting.md`. Every mechanism recommended above is explicitly
supported when self-hosting; the work is configuration, not rewriting.

| Mechanism                                                     | Works on a Node container? | What has to be configured                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<Suspense>` streaming                                        | Yes                        | **Disable proxy buffering.** `self-hosting.md` §"Streaming and Suspense" (line 239): set `X-Accel-Buffering: no` for nginx; "Load balancers must support chunked transfer encoding or HTTP/2 streaming. Some cloud load balancers (for example, **AWS ALB with Lambda integration**) may buffer responses by default." Without it PPR loses its entire TTFB advantage.                                                                                                             |
| Cache Components / PPR                                        | Yes                        | §"Cache Components" (line 279): "works by default with Next.js and is not a CDN-only feature. This includes deployment as a Node.js server (through `next start`) and when used with a Docker container." Requires the Node runtime (no `runtime = 'edge'`).                                                                                                                                                                                                                       |
| `'use cache'` (default handler)                               | Yes                        | Nothing, **for one instance**. `use-cache.md` platform table: Node.js server ✅, Docker ✅, static export ❌. Per-instance in-memory LRU; `use-cache.md` §"Runtime caching considerations" says self-hosted entries _do_ persist across requests (unlike serverless), sized by `cacheMaxMemorySize`.                                                                                                                                                                               |
| `'use cache: remote'`                                         | Yes                        | `use-cache-remote.md` platform table: Node.js server ✅, Docker ✅. Needs `cacheHandlers.remote` pointed at a handler you write (Redis/DynamoDB/S3).                                                                                                                                                                                                                                                                                                                               |
| `cacheHandlers` (for `use cache`)                             | Yes                        | `cacheHandlers.md`: `{ default: require.resolve(...), remote: require.resolve(...) }`. Must implement `get`, `set`, `refreshTags`, `getExpiration`, `updateTags`. Platform table: Node ✅, Docker ✅. Note `'use cache: private'` is **not configurable**.                                                                                                                                                                                                                         |
| `cacheHandler` + `cacheMaxMemorySize: 0` (the ISR/page cache) | Yes                        | §"Configuring Caching" (line 107). "By default, this cache is stored on the local filesystem (on disk) of each Next.js server instance … If you are hosting Next.js using a container orchestration platform like Kubernetes, each pod will have a copy of the cache." Points at the official `cache-handler-redis` example.                                                                                                                                                       |
| `revalidateTag` / `revalidatePath` across instances           | **Not by default**         | §"Multi-Instance Cache Coordination" (line 269): "calling `revalidateTag()` on one instance only invalidates the cache on that instance." Fix: implement **`refreshTags()`** (called before each request, syncs tag state from shared storage) plus `updateTags()` (writes invalidations to shared storage). `how-revalidation-works.md` §"Multi-instance with shared cache" adds: `refreshTags()` **must catch its own errors**, because a throw propagates as a request failure. |
| `updateTag` / `refresh`                                       | Yes                        | Same coordination caveat as `revalidateTag` in multi-instance.                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `after()`                                                     | Yes                        | §"`after`" (line 295): "fully supported when self-hosting with `next start`." Needs a graceful shutdown: SIGINT/SIGTERM with a **10–30 second drain period** so pending callbacks finish. On ECS that is `stopTimeout`.                                                                                                                                                                                                                                                            |
| `output: "standalone"`                                        | Yes                        | `output.md`: produces `.next/standalone` with a minimal `server.js`. `public/` and `.next/static/` are **not** copied automatically — `cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/`. `PORT` / `HOSTNAME` env vars control binding.                                                                                                                                                                                                                |

Additional multi-instance requirements from §"Multi-Server Deployments" (line 187) that the repo's
README does not yet mention:

- **`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`** — base64, 16/24/32 bytes, set at **build** time and kept
  identical across instances. Without it, "a Server Function encrypted by one instance cannot be
  decrypted by another, causing 'Failed to find Server Action' errors."
- **`deploymentId`** — version-skew protection during rolling deploys; adds `?dpl=` to assets and an
  `x-deployment-id` header, and forces a hard navigation on mismatch. Note "When `deploymentId` is
  set, Next.js uses a constant build ID and `generateBuildId` has no effect."
- **`generateBuildId`** — only if you rebuild per environment and are _not_ using `deploymentId`.

The repo's existing `next.config.ts` comment and README §"Moving to AWS later" are directionally
correct (`output: "standalone"`, shared `cacheHandler`) but **incomplete for Next 16**: they predate
`cacheHandlers` (plural, for `use cache`), `refreshTags()`, the Server Actions encryption key, and
the ALB-buffering-breaks-streaming issue. Worth an update in the same PR that enables
`cacheComponents`.

One portability trap to note explicitly: **no cache survives a deploy.**
`01-getting-started/08-caching.md` §"Where cached content is stored": "All of these stores are scoped
to a single deployment. A new deploy starts fresh … even durable `remote` ones, because the cache key
includes the build id." For a GitHub-rate-limited app deployed often, this is a real operational fact,
not a footnote.

---

## 5. What bites a DDD/CQRS layering

### 5a. `React.cache` is isolated inside every `use cache` scope — the sharpest edge

`use-cache.md` §"React.cache isolation" (line 289):

> "`React.cache` operates in an isolated scope inside `use cache` boundaries. Values stored via
> `React.cache` outside a `use cache` function are not visible inside it. This means you cannot use
> `React.cache` to pass data into a `use cache` scope … To pass data into a `use cache` scope, use
> function arguments instead."

And `migrating-to-cache-components.md` §"`React.cache`" (line 440): "each Cache Function has an
isolated React cache scope. Calls from separate Cache Functions do not share a `React.cache` result,
such as when one Cache Function preloads data and another consumes it."

**Why this matters here.** The idiomatic DDD move is a request-scoped composition root:
`const getContainer = cache(() => buildContainer())`, so every server component in a request shares
one `QueryBus`, one GitHub client, one dataloader. That memoization **silently stops working** the
moment the call happens inside a `'use cache'` function — each cached query gets its own container,
its own dataloader, its own in-flight-request dedup. You get correct results and quietly duplicated
GitHub calls, which is exactly the failure mode a rate-limited API punishes.

Mitigations the docs offer:

- Pass what the cached function needs as **arguments** (this is the recommended fix).
- If a helper reads request data and must share work across Cache Function scopes, use
  `'use cache: private'`; if it only needs request-scoped dedup, use `cacheLife({ stale: Infinity })`
  "so it does not lower the route's stale time".

**Practical shape for this repo:** keep `'use cache'` at the _query handler_ level, below the bus.
The route/page dispatches `queryBus.ask({ type: 'github-insights.openPrCounts', repoIds })`; the
handler's internal read function carries `'use cache'` + `cacheLife` + `cacheTag` and takes only
plain arguments. The bus and container stay out of the cached scope entirely.

### 5b. Module-level singletons

`QueryBus` in `src/shared/application/query-bus.ts` is a class with a `Map` of handlers, and
`register()` **throws if a handler is already registered for a type**. If it is instantiated and
populated at module scope, a hot-reload or a double-import in dev will throw
`A handler is already registered for query "…"`. In production on a long-lived Node container, a
module-scope bus is genuinely shared across requests — fine for a stateless dispatcher, dangerous if
anything request-scoped (a user's token, a correlation id) is ever stashed on it.

What the vendored docs actually say, and what they do not:

- Module scope is **endorsed** for request-independent reads:
  `01-getting-started/08-caching.md` §"Predictable values": "When those resources are expected to be
  the same for every request, read them once at module scope instead of during rendering."
- `backend-for-frontend.md` §"Deployment environment": "Route Handlers cannot share data between
  requests" — true on lambda-style hosts, **not** on the Node container this app is meant to be
  portable to. So the two deployment targets differ here, which is precisely the kind of divergence
  the repo's portability rule exists to prevent.
- **[UNVERIFIED]** The vendored docs contain no guidance on dependency-injection containers,
  composition roots, or module-level singleton lifetimes in the App Router. Nothing found under any
  of "singleton", "module-level", "module state". The conclusions above are inference from the
  `React.cache` isolation rule plus the stated Route-Handler caveat, not from an explicit statement.

**Recommendation:** build the container/bus inside `cache()` (request-scoped), and keep that call
_outside_ every `'use cache'` scope, per 5a. Register handlers idempotently or build fresh per
request so the `register()` throw cannot fire.

### 5c. Domain objects cannot cross a `use cache` boundary

`use-cache.md` §"Serialization" (line 146). Arguments use **Server Component** serialization, return
values use **Client Component** serialization (the former is stricter). Explicitly **unsupported**:

> "Class instances, Functions (except as pass-through), Symbols, WeakMaps, WeakSets, URL instances"

with a worked example: `async function UserProfile({ user }: { user: UserClass })` → "Error: Cannot
serialize class instance".

Consequences for this codebase:

- `Entity` / `AggregateRoot` / `ValueObject` / `UniqueId` (`src/shared/domain/`) are **classes**.
  They cannot be arguments to, or return values from, a `'use cache'` function, and they cannot be
  props to a Client Component. Query handlers must return **plain read-model DTOs**. This is good
  CQRS anyway — the framework is enforcing the rule the repo already states — but it means the
  `Query<TType, TResult>` `TResult` type needs to be a plain object type by construction, not
  incidentally.
- `Result<T, E>` (`src/shared/domain/result.ts`) is a plain discriminated union
  (`{ ok: true, value } | { ok: false, error }`), so the _wrapper_ is serializable. But `err()` is
  routinely handed an `Error`, and `Error` is a class instance.
  **[UNVERIFIED]** The vendored docs do not say whether `Error` is special-cased by RSC
  serialization; they only give the blanket "class instances are unsupported" rule. Safest reading:
  a query handler that returns `Result<T, Error>` out of a cached scope is unproven. Return
  `Result<T, { code: string; message: string }>` — a plain object — from anything that crosses a
  cache or server/client boundary.
- Pass-through is allowed for values you never introspect: `children`, and Server Action references.
  A cached table shell can take `children` and have the dynamic rows passed through it.

### 5d. Cached functions cannot read request APIs, and the restriction follows the call stack

`use-cache.md` §"Request-time APIs" (line 239):

> "Cached functions and components **cannot** access runtime APIs like `cookies()`, `headers()`, or
> `searchParams`, and the restriction follows the call stack: a helper the cached function calls
> that reads one of these fails the same way, with the `next-request-in-use-cache` error. **On a
> dynamically rendered route this surfaces when the route runs, so it can pass `next build` and fail
> under `next start`.**"

This is the layering trap. A perfectly clean-looking `GitHubApiClient` in `infrastructure/` that
reaches for `headers()` (or for a token via a helper that does) will compile, build, and then fail in
production the first time it is called from inside a cached query handler. **Read the token above the
cached scope and pass it as an argument** — which also keeps it out of the cache key unless you put
it there. `use-cache-remote.md` §"Cache key considerations" makes the related point that you should
cache on the low-cardinality dimension (repo id) and filter the rest in memory, never key on
per-user values.

Note the cache key also **captures closure variables automatically**
(`use-cache.md` §"Cache keys", line 79): "When a cached function references variables from outer
scopes, those variables are automatically captured and bound as arguments, making them part of the
cache key." A cached read that closes over a per-user token silently becomes a per-user cache entry
with near-zero hit rate.

### 5e. Route handlers and server actions stay thin — the framework agrees

- `use cache` **cannot** be applied to the `GET` export of a Route Handler; it must be a helper
  (`15-route-handlers.md`). That helper is the query handler. Good.
- `updateTag` and `refresh` throw outside Server Actions; `revalidateTag` works in both. So the
  invalidation call belongs in the thin action/handler layer, not in the domain — which also means
  the _tag vocabulary_ is an application-layer concern that has to be shared between the query
  handler (which calls `cacheTag`) and the command side (which calls `updateTag`). Put it in one
  module under `application/` so the two cannot drift.
- Server Actions are POST endpoints reachable by anyone who can send the request
  (`server-actions.md` §"Security", line 76: "Treat every action as an untrusted entry point"), so
  authorization belongs _inside_ the action, before the dispatch.

### 5f. `cacheComponents` is all-or-nothing per app, with a per-segment escape hatch

Enabling the flag "applies prerender validation across every route, not just the ones in this step"
(`interactive-apps.md` Step 8). The escape hatch is `export const instant = false` on a page/layout,
or the `cache-components-instant-false` codemod to add it everywhere at once
(`migrating-to-cache-components.md` §"Adopting incrementally"). Note `instant = false` does **not**
clear synchronous-IO build errors: `new Date()`, `Math.random()`, `crypto.randomUUID()` during
prerender still fail the build and must be moved behind `connection()` + `<Suspense>`, or wrapped in
`await io()`. Also, after enabling, any segment still exporting `dynamic`, `revalidate`, or
`fetchCache` **errors**. The repo has none of those today, so this is a clean-slate adoption — one of
the few advantages of doing it before the feature is written.

---

## Concrete recommendation

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Add when moving to a container host:
  // output: 'standalone',
  // cacheHandlers: { remote: require.resolve('./cache-handlers/redis.js') },
  // deploymentId: process.env.DEPLOYMENT_VERSION,
};
export default nextConfig;
```

```tsx
// src/app/page.tsx — synchronous, never awaits searchParams
export default function Page({ searchParams }: PageProps<"/">) {
  return (
    <main>
      <h1>Watched repositories</h1>
      <Suspense fallback={<RepoTableSkeleton />}>
        <RepoTable searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
```

- `RepoTable` awaits `searchParams`, derives `openRepoIds`, renders one `<RepoRow>` per repo.
- `<RepoRow>` renders the name synchronously and wraps `<RepoCounts repoId>` in its own `<Suspense>`.
- If the row is open, it additionally renders `<Suspense><OpenPrList repoId /></Suspense>`, which in
  turn nests `<Suspense><PrChecks prId /></Suspense>` per PR the user drills into.
- Every read goes `component → queryBus.ask(...) → handler → cached read fn` where the cached read fn
  carries `'use cache'`, `cacheLife('minutes')`, `cacheTag('repos', \`repo-${id}\`)` and takes only
  plain arguments.
- The expand/collapse control is a client component doing `router.push` in a transition with
  `useOptimistic` + `data-pending`.

## Open questions this research surfaced (not in scope to decide here)

1. **Deploy-time cache cold start.** `use cache` (and `use cache: remote`) entries do not survive a
   deploy, because the build/deployment id is in the key. On a rate-limited GitHub API with frequent
   deploys, the first visitor after each deploy pays full cost for every visible row. The documented
   workarounds are `unstable_cache` or the `fetch` cache — both of which are the _previous_ model and
   sit awkwardly beside Cache Components. Worth an explicit decision, possibly: own the GitHub
   response cache in `infrastructure/` (Postgres/Redis) and let `use cache` be purely a
   render/prefetch concern.
2. **Whether `Error` instances survive RSC serialization out of a `use cache` scope.**
   **[UNVERIFIED]** from the vendored docs. Cheap to settle with a spike; cheaper still to just
   return plain error objects.
3. **`partialPrefetching: true`?** It would make repeat navigation instant but costs a server
   invocation per `prefetch={true}` link. Probably yes for the app shell, no for per-row links, given
   the rate limit.

---

## Sources read (all paths relative to `node_modules/next/`)

Docs:

- `dist/docs/01-app/01-getting-started/06-fetching-data.md`
- `dist/docs/01-app/01-getting-started/08-caching.md`
- `dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`
- `dist/docs/01-app/01-getting-started/15-route-handlers.md`
- `dist/docs/01-app/02-guides/upgrading/version-16.md`
- `dist/docs/01-app/02-guides/caching-without-cache-components.md`
- `dist/docs/01-app/02-guides/migrating-to-cache-components.md`
- `dist/docs/01-app/02-guides/self-hosting.md`
- `dist/docs/01-app/02-guides/how-revalidation-works.md`
- `dist/docs/01-app/02-guides/streaming.md`
- `dist/docs/01-app/02-guides/interactive-apps.md`
- `dist/docs/01-app/02-guides/server-actions.md`
- `dist/docs/01-app/02-guides/backend-for-frontend.md`
- `dist/docs/01-app/02-guides/preserving-ui-state.md`
- `dist/docs/01-app/03-api-reference/01-directives/use-cache.md`
- `dist/docs/01-app/03-api-reference/01-directives/use-cache-remote.md`
- `dist/docs/01-app/03-api-reference/01-directives/use-cache-private.md`
- `dist/docs/01-app/03-api-reference/03-file-conventions/page.md`
- `dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/instant.md`
- `dist/docs/01-app/03-api-reference/04-functions/{after,cacheLife,connection,io,refresh,revalidateTag,updateTag,unstable_cache,use-search-params}.md`
- `dist/docs/01-app/03-api-reference/05-config/01-next-config-js/{cacheComponents,cacheHandlers,output,partialPrefetching,staleTimes}.md`

Shipped code and types (used to confirm, not just read about, the 16.3.5 surface):

- `package.json` (version `16.3.5`)
- `cache.d.ts`, `cache.js` (exports of `next/cache`)
- `dist/server/web/spec-extension/revalidate.d.ts` (`revalidateTag` second arg is required)
- `dist/server/use-cache/cache-tag.js`, `dist/server/use-cache/cache-life.js` (E886/E885/E819 guards)
- `dist/server/config-shared.d.ts` (top-level `cacheComponents`, `cacheHandlers`, `cacheHandler`, `partialPrefetching`, `output`)
- `dist/server/config.js` (`cacheComponents` ⇒ `experimental.useCache`)

Repo context:

- `CLAUDE.md`, `AGENTS.md`, `README.md`, `next.config.ts`, `package.json`
- `src/shared/application/{query-bus.ts,messages.ts}`
- `src/shared/domain/{result.ts,entity.ts}`
