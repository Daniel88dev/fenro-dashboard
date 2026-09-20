# How does the Tasks column cross the context boundary?

Type: grilling
Status: open
Blocked by: 06, 08
Part of: [map](../map.md)

## Question

One table row shows data from two bounded contexts. `github-insights` must not
import from `tasks`, and `tasks` must not import from `github-insights`, so
something has to join them — and where that join lives is an architecture
decision, not a detail.

Candidates to grill:

- **Join in the route.** The server component asks both buses — repository rows
  from one, task counts by repository from the other — and zips them on
  `owner/name`. Contexts stay ignorant of each other; the app layer knows both.
  Cheapest, and arguably correct, since the _dashboard_ is the thing that wants
  both, not either context.
- **A third context that composes.** A `dashboard` module owning the combined
  read model. Honest about the composition being a real concept, at the cost of
  a module whose only job is a join.
- **`tasks` publishes counts that `github-insights` reads.** Rejected on sight
  unless someone argues for it: it makes the GitHub context depend on the task
  context for something it does not own.

Sub-questions:

- What is the join key? A `WatchedRepositoryId` that `tasks` stores would couple
  the contexts through an identifier; `owner/name` as a plain string pair does
  not, but can go stale when a repository is renamed.
- A task created from a pull request also references a PR number. Is that a typed
  reference or an opaque string the tasks context never interprets?
- What happens to tasks when a repository is unwatched? They are not the GitHub
  context's to delete.
