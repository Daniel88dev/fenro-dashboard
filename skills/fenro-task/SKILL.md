---
name: fenro-task
description: Work a Fenro task with the skills its labels bring. Use when the user names a task key (T-12, HAL-3), pastes a Fenro task link, or asks for the next task.
---

Work one **Fenro** task end to end. Fenro's MCP server carries the work loop, the formatting rules and the order in which instructions win; follow them. This skill adds what the server cannot know: this repository, the person's grilling preference, and the skills installed on this machine.

### 1. Check Fenro

Fenro's tools (`start_task`, `list_tasks`, …) are available in this session. When they are missing, tell the person to run `/fenro-setup`, and stop. Read `docs/agents/fenro.md` when it exists: it names the repository, the space and the grilling mode.

Done when the tools answer and you know the repository and grilling mode (without the notes file: the git remote as `owner/name`, and grilling on the task).

### 2. Pick the task

- With a key or a task link from the person: that task.
- Without: `list_tasks` with `ready: true` and the repository, show the top five by key and title, recommend the first, and let the person choose. When none is ready for this repository, say so and offer the same list across all their tasks.

Done when one key is chosen.

### 3. Start it

`start_task` with the key. Read the brief as the server's instructions describe.

### 4. Load its skills

The brief lists the skills the task's labels bring. For each one:

- Follow its instructions for the whole task.
- Instructions `null`: read it with `get_skill`.
- A **pointer** to an installed skill ("Use the installed `tdd` skill…"): invoke that skill by name now.
- A pointer to a skill that is not installed: tell the person, record it with `add_note`, and carry on with the rest.

Done when every skill in the brief is loaded or recorded as missing.

### 5. Work it

Do the work as the server's loop describes. A decision only the person can make goes out in the grilling mode from step 1:

- **On the task**: `ask_questions` with your recommended answer marked on each question, then `wait_for_answers`. When the wait runs out, `finish_session` with outcome `paused`; the next session's brief carries the answers.
- **In the session**: ask in the conversation, then record each decision with `add_note`.
- **Ask each time**: ask the person which, once for this task.

### 6. Finish

Done when every acceptance criterion is checked with `check_criterion` and its evidence, or explained in the handoff, and `finish_session` has recorded an outcome. Tell the person the outcome and the task's link.
