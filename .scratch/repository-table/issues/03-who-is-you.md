# Who is "you"?

Type: grilling
Status: open
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
