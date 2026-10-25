# Issue tracker: Fenro

Issues and specs for this repository live as tasks in Fenro, reached through its MCP tools. Repository `<owner/name>`, space `<T or a group prefix>`.

## Conventions

- A spec, or any larger piece of work, is an **epic**: `save_task` with `type: "epic"`, the spec in its description.
- An implementation issue is a **task** under it: `save_task` with the epic's key as `parent`, the repository set, its acceptance criteria in `add_criteria`.
- Triage state is a **label** on the task (see `triage-labels.md` for the role strings).
- Comments and conversation go in the task's journal with `add_note`.
- Questions only the person can answer go to the task as a round with `ask_questions`.

## When a skill says "publish to the issue tracker"

`save_task` in the space above, with the repository set. Name the result by its key, like T-12.

## When a skill says "fetch the relevant ticket"

`get_task` with the key or the task's link.

## Wayfinding operations

Used by `/wayfinder`. The **map** is an epic with one **child** task per ticket.

- **Map**: the epic's description holds the Destination / Notes / Decisions-so-far / Not-yet-specified / Out-of-scope body.
- **Child ticket**: a task with the epic as `parent`, the question in its description, and a label for its type (`research`, `prototype`, `grilling`, `task`).
- **Blocking**: `link_tasks` with `kind: "blocked_by"`. Fenro derives a blocked state from it.
- **Frontier**: `list_tasks` with `epic` and `ready: true`; the first one wins.
- **Claim**: `start_task` before any work.
- **Resolve**: `finish_session` with outcome `done` and the answer as the summary, then `add_note` on the epic with the gist and the child's key, and update the map's Decisions-so-far.
- **Grilling ticket**: ask its questions as a round with `ask_questions` on the child task, and resolve it once the round is answered.
