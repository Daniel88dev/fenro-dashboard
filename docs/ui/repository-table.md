# The repository table

The dashboard's home screen: one row per watched repository, with **Open PRs**,
**Issues** and **Tasks** as columns. Clicking a count expands the row in place to
the detail behind it. Inside an expanded pull request, its CI status and every
individual check are visible.

Prototypes: [Fenro Dashboard UI prototypes](https://claude.ai/artifact/CHoCsPDAWY2tvnoL7gHW9t)
— five artboards. The first is interactive; press Play and click the counts.

All data in the prototypes is invented. Nothing was read from GitHub, and none of
the prototype markup is meant to be copied into the app: it is a picture of the
result, not a head start on the code.

## Why this shape

The two halves of the product — GitHub insights and the agentic task list — meet
in a single row. A repository's open pull requests, its open issues and the tasks
you are running against it sit side by side, so the question "what is happening
with this repository" is answered without leaving the table. The Tasks column is
what makes this a dashboard for _your_ work rather than a second GitHub.

Expanding in place rather than navigating keeps the comparison: you can see that
`billing-core` has four pull requests needing you while `edge-proxy` has none,
and still drill into one of them.

## Layout

### Chrome

A near-black top bar carrying the product name, the primary nav (Repositories,
Tasks, Settings) and a freshness indicator reading `synced 4 min ago`. That
indicator is load-bearing: it tells the reader the numbers are a snapshot, not
live, which is what makes a rate-limited data source honest. See
[Open decisions](#open-decisions) — whether a snapshot is what we actually build
is not yet settled.

### Page header

The page title, the count of watched repositories, and three totals across all of
them: open pull requests, open issues, tasks. Then a toolbar: a repository
filter, **Sync now**, **Watch a repository**.

### The table

| Column        | Content                                                           |
| ------------- | ----------------------------------------------------------------- |
| Repository    | Name in mono, owner beneath it in muted text                      |
| Open PRs      | Count, with a hint line: `3 need you`, `none need you`            |
| Issues        | Count, with a hint line: `4 assigned`                             |
| Tasks         | Count, with a hint line: `1 running`, `2 running`, `none running` |
| Last activity | Relative time: `26 min ago`                                       |

Each count is the affordance. The hint under it is the reason to click.

## Expansion

Clicking a count opens a panel directly beneath that row, scoped to the column
clicked. The panel opens with a one-line summary of what is in it
(`3 waiting on your review, 1 with failing checks`), then the list, then a
`Show the other 8 pull requests` link — the panel shows what needs attention, not
everything.

### Pull requests

Per pull request: number, title, `author · age`, a review-state chip
(`your review`, `changes requested`, `2 approvals`, `draft`, `no reviewers`) and a
CI chip (`6 passed`, `1 failed`, `2 running`).

Clicking a pull request opens its checks: the head SHA in mono, then every check
with its name, duration and conclusion — `lint 39 s passed`,
`typecheck 1 m 04 s failed`, `integration — skipped`. Beneath the checks, a plain
sentence saying what is actually blocking it: _"Tom requested changes 12 days ago,
and the typecheck job has been red since."_ Then two actions:
**Make a task from this** and **Open on GitHub**.

_Make a task from this_ is the seam between the two halves of the product. A
failing check is usually the start of a task, so the task is created from the
pull request and arrives already carrying it as context.

### Issues

Filter chips (`Assigned to me`, `Needs triage`, `Oldest first`), then per issue:
number, title, a label chip, age, assignee, comment count.

### Tasks

Per task: id, title, a last-activity line (`Session 1 running, 6 min in`,
`Blocked on finance since 9 Sept`), a state chip
(`running` / `paused` / `blocked` / `ready`), the number of context items it
carries, and an action (`Watch` / `Open` / `Resume`). A **New task here** button
creates one already scoped to the repository.

The context-item count is the visible proof that a task accumulates something
worth handing to the next session.

## Visual language

Warm paper rather than the scaffold's plain zinc, and two accents used
**semantically everywhere** — a colour always means the same thing.

| Token            | Value     | Meaning                                       |
| ---------------- | --------- | --------------------------------------------- |
| `ground`         | `#F6F5F1` | Page background                               |
| `surface`        | `#FFFFFF` | Table, panels, cards                          |
| `surface-sunken` | `#F1EFE9` | Expanded panel background                     |
| `hairline`       | `#E3E1DA` | Borders and row rules                         |
| `ink`            | `#16161A` | Primary text                                  |
| `ink-muted`      | `#6B6B72` | Secondary text, hints                         |
| `ink-faint`      | `#9A9AA0` | Timestamps, counts at rest                    |
| `bar`            | `#1C1D19` | Top bar                                       |
| `pr`             | `#2E6F63` | Pull requests, passing checks, healthy states |
| `pr-strong`      | `#235A50` | Hover / pressed on the above                  |
| `issue`          | `#A2542C` | Issues, failures, things going stale          |
| `issue-strong`   | `#8A4626` | Hover / pressed on the above                  |
| `running`        | `#B8862F` | Checks and sessions still in flight           |
| `pr-wash`        | `#E4EFEB` | Tint behind a teal chip                       |
| `issue-wash`     | `#F6E9E1` | Tint behind a rust chip                       |

Typography: **Geist** for prose and UI, **Geist Mono** for every repository name,
count, branch, SHA, issue or PR number, task id and check name. Anything that is
an identifier or a quantity is mono; anything that is a sentence is not.

When these are adopted they belong in `src/app/globals.css` as Tailwind v4
`@theme` tokens, not as hex values scattered through components.

## The alternatives, and what they were for

Four further artboards exist, each answering a different question:

1. **Issues and tasks expanded together** — the same table with two different rows
   open on two different columns at once. It exists to ask whether that is allowed.
2. **One panel with tabs** — the row opens once; the column you clicked selects a
   tab, and you can switch tabs without collapsing. Costs one click to compare
   columns, but the row never jumps.
3. **Side drawer** — the table never moves. A count opens a drawer on the right;
   clicking another count swaps its contents. The most stable layout, and the only
   one where a very wide detail view is comfortable.
4. **Dense table** — one line per repository, so twenty fit on a laptop screen,
   with a CI column showing the health of every open pull request as a row of dots.
   The best overview, the worst for detail.

## Open decisions

These are tracked as tickets on the wayfinder map at
[`.scratch/repository-table/map.md`](../../.scratch/repository-table/map.md).
Two bear directly on this document:

- ~~**Which expansion mechanic, and may several rows be open at once?**~~
  **Settled on 2026-09-20**: the first artboard — inline expansion under the
  row, scoped to the column clicked, several rows open at once on different
  columns. The drawer, the tabbed panel and the dense table are not the screen.
- **Is the table a live read or a snapshot?** The `synced 4 min ago` indicator and
  the **Sync now** button assume a snapshot. If the app reads GitHub live per
  request, both disappear and the freshness language changes.

## What the built screen leaves out

Slices 0 to 2 built this screen on fake data. Four things in the description
above are deliberately absent, each because it belongs to a slice or a ticket
that has not landed:

- **`Sync now` and the `synced 4 min ago` indicator.** Both assume the numbers
  are a snapshot, which is exactly what ticket 05 has not decided. Building them
  would answer that question by accident.
- **`Make a task from this` and `New task here`.** The seam between the two
  halves of the product, and slice 7's to build.
- **The task actions** — `Watch`, `Open`, `Resume`. They start and resume agent
  sessions, which needs the `Task` aggregate (slice 8).
- **The issue filter chips.** Real filtering over real issues, which is slice 5.

Two smaller departures from the description: `Show the other 8 pull requests`
links out to GitHub's own list, because the fake data holds only the subset the
panel shows; and an issue's comment count is missing, because the prototype's
sample data never had one.

## Not yet drawn

The prototypes show the happy path only. The empty state and a failed panel are
now built and tested. Each of the rest still needs a decision and a design:

- **Empty**: no repositories watched yet; a repository with nothing open.
- **Loading**: the table shell before the counts arrive, and a panel before its
  detail arrives. With counts and detail loaded separately, these are two
  different states.
- **Error**: a repository whose last sync failed, and a panel whose detail could
  not be fetched, without failing the whole table.
- **Rate-limited**: what the header says when GitHub has refused a refresh.
- **Narrow viewports**: the table is drawn at 1280px. Five numeric columns plus a
  name do not survive a phone unchanged.

## Accessibility notes for implementation

The prototypes are pictures; these are requirements the real thing must meet and
the prototypes do not prove. Everything in this list except the last is met and
tested by the built screen.

- Each count is a real `<button>` carrying `aria-expanded` and `aria-controls`
  pointing at its panel, not a clickable cell. A count alone is not an accessible
  name: label it (`12 open pull requests in nordwind/billing-core`).
- Colour is never the only carrier of meaning. A failing check reads `failed`, a
  passing one reads `passed`; the dots in the dense variant need text alternatives.
- `#6B6B72` on `#F6F5F1` clears 4.5:1. `#9A9AA0` does not — restrict it to text at
  24px and above, or darken it.
- Expanding a row must not move focus, and collapsing must return focus to the
  count that opened the panel.
- Relative times (`26 min ago`) need a `<time datetime>` with the absolute value.
