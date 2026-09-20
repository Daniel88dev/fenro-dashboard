# Who is "you"?

Type: grilling
Status: **resolved** — 2026-09-20
Blocked by: —
Part of: [map](../map.md)

## Question

The table is full of the first person — `3 need you`, `4 assigned`,
`your review`, `changes requested`. All of it needs an identity. Which one?

- A single-user app authenticated by a `GITHUB_TOKEN` in the environment, where
  "you" is whoever owns that token and there is no sign-in at all. The env schema
  already carries `GITHUB_TOKEN` as optional, so this is the path of least
  resistance.
- GitHub OAuth sign-in, where "you" is the signed-in account and the app holds a
  token per user. Needed the moment a second person uses it, and needed anyway if
  the app should work without the owner pasting a PAT.
- A GitHub App installation, where the app has its own identity and "you" is
  resolved separately.

Settling this settles more than a login screen: whether watched repositories are
global or per user, whether the token is a deployment secret or a stored record,
what ticket 07 has to persist, and what happens to the review-state language if
there is no identity at all.

It also fixes the scopes available, which the fog around writing back to GitHub
depends on.

Worth grilling rather than assuming: the cheap answer (a PAT in the environment)
may be exactly right for a solo dashboard, and the expensive one is easy to drift
into by default.

## Answer

**Sign in with GitHub.** Daniel chose OAuth sign-in on 2026-09-20: "you" is the
signed-in account, and the app holds a token per user rather than one in the
environment.

What follows from it, and what is already built against it:

- The viewer and the credentials that read GitHub on their behalf are both
  **per-request facts**, so they are a port rather than configuration:
  `application/ports/viewer.ts`. Until the login exists, `SampleViewerProvider`
  stands in, and the sample data already distinguishes the viewer from everyone
  else through that port — the fake reader maps the signed-in login to "you".
- The composition root is **built per request** and given the viewer, so the
  OAuth adapter plugs in there without the domain or any query handler changing.
- Ticket 02's fourth finding now binds: the token must be read **above** every
  `use cache` scope and passed in, never reached for from inside one.
- Still open, and now ticket 07's to answer: whether watched repositories are
  per user or global, and where the per-user token is stored.
- `GITHUB_TOKEN` stays in the env schema as the optional fallback it already is;
  the OAuth client id and secret are added when the login is built.

The login itself is **not built yet** — slices 0 to 2 run on fake data.
