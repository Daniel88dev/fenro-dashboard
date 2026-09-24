# Task management for AI agents: research and proposed design

Written 2026-09-23. Answers wayfinder tickets 07 (what persists for tasks), 08
(the task domain model) and 09 (the Tasks column join). Daniel chose option A
for the aggregate boundary; the rest is built as recommended here, and PR 1 of
section 7 implements it.

## 1. What the research found

Surveyed: Linear, Jira, GitHub Issues, Asana, Todoist/Things, Taskwarrior, and
the agent-first trackers beads (`bd`), Task Master, Backlog.md, Shrimp, plus the
MCP servers of Linear, GitHub and Atlassian.

What every human tracker has: a parent/sub-task hierarchy, blocking
dependencies (Linear, GitHub and Asana all model "blocks / blocked by"), a
small non-blocking set (related, duplicate), a status that falls into fixed
categories (Linear: backlog / unstarted / started / completed / canceled),
priority, labels and comments. Jira adds **remote links**: a link to an object
in another system with a stable global id so it can be upserted.

What the agent-first trackers add, and why it matters to an agent:

| Pattern                                         | Pioneered by                                                        | Why an agent needs it                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Ready queue computed from the dependency graph  | beads `bd ready`, Task Master `next_task`                           | "What should I do next?" in one call                                    |
| Atomic claim with a lease that expires          | beads `--claim`, mcp_agent_mail                                     | Two agents never take one task; a crashed agent doesn't hold it forever |
| `discovered-from` links                         | beads                                                               | Record work found mid-task without derailing the current task           |
| Append-only notes / journal                     | beads `note`, Task Master `update_subtask`, Taskwarrior annotations | Context survives between sessions and can't be rewritten                |
| Checkable acceptance criteria                   | Backlog.md, Shrimp `verificationCriteria`                           | An objective finish line                                                |
| Handoff / final summary on completion           | Backlog.md, Shrimp                                                  | The next session reads one field instead of the whole history           |
| Compact reads by default, full detail on demand | beads-mcp `brief` mode                                              | Unbounded reads cost 100K+ tokens in existing servers                   |
| Cycle rejection at write time                   | Task Master, beads                                                  | Beads had ready-queue deadlocks from cycles and parent-child blocking   |
| Small tool surface                              | Linear `save_issue`, Task Master tiers                              | Tool schemas themselves cost context tokens                             |

Left for later: compaction of old closed tasks, complexity scoring and
automatic expansion (the calling agent can do that itself), urgency scores,
custom workflows, estimates and due dates, file leases between agents.

## 2. The domain model (ticket 08)

### Aggregate boundary _(decided by Daniel: A)_

**A. Every task and sub-task is its own `Task` aggregate _(recommended)_.**
A sub-task is a task with a `parentId`; "A blocks B" is stored on B. Sessions
and notes live inside their task. The rules that span tasks (no cycles in
blocking or in parenting) are checked by a small domain service over the
owner's task graph before the change is saved.
Every sub-task can be claimed, blocked and finished on its own, which is what
an agent needs.

**B. One `Task` aggregate owning its sub-tasks as child entities.**
Parent-child rules are local, but a sub-task can't be claimed by one agent
while another works a sibling without contending on the parent, and blocking
across trees still needs the graph service.

**C. One `Board` aggregate per repository owning all tasks and edges.**
Every graph rule is inside one aggregate, but every write from every agent
contends on the same row.

### What a `Task` holds (option A)

- **Identity**: a UUID plus a short key per owner, `T-1`, `T-2`… (agents and
  humans both read keys better than UUIDs).
- **Owner**: the signed-in user id. Every read and write is scoped to it.
- **Title, description** (markdown), **priority** (`urgent`, `high`, `medium`,
  `low`, `none`), **labels**.
- **Repository** (optional `owner/name`, a plain string pair as the plan
  proposed). Sub-tasks inherit it from their parent unless given one.
- **Parent** (optional task id).
- **Blocked by**: the tasks that must finish first. Plus two non-blocking
  relations: `relates-to`, and `discovered-from` (set when an agent files a
  task it found while working another).
- **External references**: zero or more `{ system, key, url, title }` value
  objects. Systems: `github-issue`, `github-pull-request`, `jira`, `linear`,
  `url`. Parsed from a pasted URL where the format is known
  (`github.com/o/r/issues/12` → `github-issue o/r#12`, `*.atlassian.net/browse/PROJ-4`
  → `jira PROJ-4`). One may be marked as the **source** the task came from.
  Upserted by `system + key`, like Jira's remote links. Read-only: fenro does
  not sync with Jira or GitHub; the agent uses its own Jira or GitHub tools to
  read the source.
- **Acceptance criteria**: an ordered checklist; each item can be checked with
  optional evidence ("tests pass in CI run 123").
- **Status**, one of six fixed categories: `backlog`, `todo`, `in_progress`,
  `in_review` (the agent's work is waiting on a human, e.g. an open PR),
  `done`, `cancelled`. **Blocked and ready are not statuses**: they are derived
  (a task is blocked while any task it depends on is open, or while it carries
  a manual hold like "waiting on finance"; it is ready when it is `todo`,
  unblocked, unclaimed and has no open sub-tasks). This settles the ticket-08
  observation that `blocked`/`ready` describe the world while
  `running`/`paused` describe a session: they are separate axes.
- **Hold** (optional): a manual "blocked on something outside fenro" with a
  reason, for things like the prototype's "Blocked on finance since 9 Sept".
- **Sessions** (entity): an agent's claim on the task. `agent` label, started,
  last seen, ended, outcome. **Invariant: at most one live session per task.**
  A session lapses after 2 hours without activity, so a crashed agent frees the
  task; any write the session makes renews it.
- **Journal** (value objects, append-only): `note`, `decision`, `discovery`,
  `question`, `handoff`, each with author (a session or the human) and time.
  Never edited or deleted; a correction is a new entry.

### Rules the aggregate enforces (all return `Result`, never throw)

- Only a ready task can be claimed; claiming an already-claimed task fails
  with who holds it and until when. A task in the `backlog`, on hold, blocked,
  or still `todo` with open sub-tasks is refused with what to do instead. A
  paused task (`in_progress`, no live session) and one sent back from
  `in_review` can be resumed by key.
- A task can't be marked `done` while it has open sub-tasks or unchecked
  acceptance criteria; the error lists what is open.
- Finishing a session requires a handoff summary (it becomes a `handoff`
  journal entry), so the next session always has one.
- No cycles through blocking or parenting (graph service, checked before save).
- Done and cancelled tasks can be reopened; nothing is ever hard-deleted by an
  agent (cancel instead). Humans can delete from the UI.

### Handoff brief: derived, not stored

`get_task` returns the brief: description, criteria with their state, status
and why it is blocked, open sub-tasks, blockers, links, the latest handoff, all
decisions, and the most recent notes (capped). The ticket raised hand-picked
briefs; that can be added later as pinning without changing the journal.

## 3. What persists (ticket 07)

Postgres via Drizzle, like the rest: `task`, `task_dependency` (blocked task,
blocking task, kind), `task_external_reference`, `task_acceptance_criterion`,
`task_session`, `task_journal_entry`, and a per-owner key counter. Optimistic
concurrency with a `version` column, as `WatchedRepository` does. No foreign
key to identity tables, same as github-insights.

## 4. The MCP server

- Route: `POST /api/mcp`, Streamable HTTP, stateless, on the official SDK
  (`@modelcontextprotocol/server` v2, whose `createMcpHandler` takes a Web
  `Request` and returns a `Response`, so it runs the same on Vercel and a
  container). Serves both the 2026-07-28 spec and older clients.
- The route is thin: verify the token, then each tool dispatches a command or
  asks a query on the buses. Tool definitions live in
  `src/modules/tasks/mcp/`, a second driving adapter beside `ui/`.
- Tools (compact output by default, full detail only in `get_task`):

| Tool              | What it does                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| `list_tasks`      | Filter by status, repository, label, parent, text; `ready: true` gives the ready queue ordered by priority then age |
| `get_task`        | The full handoff brief for one task                                                                                 |
| `save_task`       | Create or update: title, description, priority, labels, repository, parent, criteria, links, `discoveredFrom`       |
| `start_task`      | Claim a ready task and open a session; returns the brief                                                            |
| `add_note`        | Append a journal entry (note, decision, discovery, question)                                                        |
| `check_criterion` | Tick or untick an acceptance criterion, with evidence                                                               |
| `link_tasks`      | Add or remove `blocks`, `relates-to`                                                                                |
| `finish_session`  | End the session with a handoff summary and an outcome: `done`, `paused`, `blocked` (with a reason), `in_review`     |
| `set_status`      | Move to backlog, todo or done, cancel, reopen, set or clear a hold                                                  |

Plus one prompt, `work_on_next_task`, that tells an agent the loop:
`list_tasks ready` → `start_task` → notes → `finish_session`.

## 5. Agent access (auth)

**Personal access tokens first.** Daniel mints a token on a new Settings →
Agent access page (shown once, stored as a SHA-256 hash, with a name, scopes
`tasks:read` / `tasks:write`, an expiry and last-used time) and gives it to the
agent:

    claude mcp add --transport http fenro https://<app>/api/mcp \
      --header "Authorization: Bearer fenro_pat_..."

Works in Claude Code and Cursor today. **OAuth 2.1 later**, when Claude Desktop
or claude.ai connectors matter (they are OAuth-first for personal accounts):
Better Auth's `@better-auth/mcp` plugin on the same URL and header; tokens are
told apart by the `fenro_pat_` prefix, so existing agents keep working.
Tokens live in the `identity` context.

## 6. The Tasks column join (ticket 09)

Keep the plan's proposal: the route asks both buses and zips on `owner/name`.
Unwatching a repository leaves its tasks alone; they still show on the Tasks
page.

## 7. How it ships

- **PR 1**: domain model, Postgres tables and migration, commands and queries,
  the MCP server, personal access tokens with a small Settings page to mint
  and revoke them, and the real data behind the Tasks column and panel. Daniel
  can connect Claude Code to it and work tasks end to end.
- **PR 2**: the Tasks page (list, detail with the journal, creating and editing
  by hand), **New task here** and **Make a task from this** on the repository
  table.
- **Later**: OAuth for Claude Desktop, compaction, pinning in the brief.
