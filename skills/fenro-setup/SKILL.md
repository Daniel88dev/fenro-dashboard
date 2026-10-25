---
name: fenro-setup
description: Set up this repository to work from Fenro tasks, store your installed skills in Fenro behind labels, and choose how agents grill you.
disable-model-invocation: true
---

Set this repository up to work from **Fenro**, the task list agents work from through its MCP server. This is a prompt-driven setup: explore, present what you found, confirm with the person, then write. Each step ends on a check; move on only when it holds. Running it again updates what an earlier run wrote.

### 1. Explore

Gather the facts yourself, without asking the person:

- The git remote, as `owner/name`.
- `CLAUDE.md` and `AGENTS.md` at the root, and whether either has a `## Fenro` block.
- `docs/agents/fenro.md` and `docs/agents/issue-tracker.md`.
- `.mcp.json`, and whether Fenro's tools (`list_labels`, `start_task`, …) are available in this session.
- Every installed skill and where it comes from: your own list of available skills, `npx skills ls` and `npx skills ls -g`, the folders `.claude/skills/`, `.agents/skills/` and `~/.claude/skills/`, and enabled plugins.
- Whether Matt Pocock's skills are among them (names like `grilling`, `tdd`, `to-tickets`, `setup-matt-pocock-skills`).

Done when you can state the repository, whether Fenro is connected, and every installed skill with its source.

### 2. Connect Fenro

Skip this step when Fenro's tools are available. Otherwise:

1. Ask for the address of their Fenro (`https://www.fenro-dashboard.com` unless they host their own).
2. Send them to **Settings → Agent access** there (`<address>/settings`) to create a token with **Can change tasks** ticked. The page shows the connect command for Claude Code, Cursor and Codex.
3. They run that command in their own terminal, so the token stays on their machine and out of this conversation. For Claude Code it is `claude mcp add --transport http fenro <address>/api/mcp --header "Authorization: Bearer <token>"`, which stays private to them in this project.
4. When the repository is shared with a team, offer a committed `.mcp.json` that reads the token from each person's environment instead:

   ```json
   {
     "mcpServers": {
       "fenro": {
         "type": "http",
         "url": "<address>/api/mcp",
         "headers": { "Authorization": "Bearer ${FENRO_TOKEN}" }
       }
     }
   }
   ```

5. MCP servers load when a session starts: ask them to restart the agent and run `/fenro-setup` again, then stop.

Done when `list_labels` answers.

### 3. Matt Pocock's skills

Read [`matt-pocock.md`](matt-pocock.md) and follow it. Done when `docs/agents/issue-tracker.md` names its tracker, or the person declined his skills.

### 4. Grilling preference

Ask one question: when an agent needs the person's decisions (a grilling session, a design direction, a scope call), where should the rounds of questions happen?

- **On the task** (recommended): the agent posts each round with `ask_questions`, so it shows on the task page and can be answered from a phone, then calls `wait_for_answers` while the person is around and finishes the session as paused when the wait runs out. The answers stay on the task for the next session.
- **In the session**: rounds are asked in the conversation, and the agent records the decisions with `add_note`.
- **Ask each time**: the agent asks which, per task.

Done when you have the answer; step 6 records it.

### 5. Skills behind labels

Fenro gives an agent the skills linked to a task's labels when it starts that task. Build one table of every installed skill, plus the skills Fenro already has (`list_skills`), against the labels Fenro has (`list_labels`). For each skill propose:

- **a label**, reusing an existing one before inventing a name (labels are lower-case, words joined by hyphens);
- **pointer or copy**: a **pointer** for an installed skill, a few lines naming it so the agent invokes the installed one, which stays current and keeps its sibling files; a **copy** of the full text only for the person's own single-file skills, which then live in Fenro. A pointer reads like:

  > Use the installed `tdd` skill for this task. If it is not installed, install it with `npx skills add mattpocock/skills --skill tdd`.

Leave out skills that apply to every task anyway, and this setup's own skills. Put the table to the person as one round, in the mode chosen in step 4, worded so "yes" accepts it, and take their changes. Then `save_skill` each accepted row with its `labels`; for a skill Fenro already has, change only its labels.

Done when every installed skill has a decision and `list_skills` shows every accepted one with its labels.

### 6. Write the repository's Fenro notes

Draft both files, show them, let the person edit, then write:

- `docs/agents/fenro.md`:

  ```markdown
  # Fenro

  Tasks for this repository live in Fenro at <address>.

  - Repository: `<owner/name>` (pass it to `list_tasks` as `repository`)
  - Space: <T for personal tasks, or a group prefix such as HAL>
  - Grilling: <on the task | in the session | ask each time>
  - Labels: <the labels agreed in step 5 and what each means here>
  ```

- A `## Fenro` block in `CLAUDE.md`, or in `AGENTS.md` when only that exists (when neither exists, ask which to create):

  ```markdown
  ## Fenro

  Work comes from Fenro tasks; use the `fenro-task` skill to pick one and work it. Repository, space, grilling mode and labels: see `docs/agents/fenro.md`.
  ```

  Update an existing `## Fenro` block in place.

Done when both are written. Tell the person setup is complete and that `fenro-task` (install it with `npx skills add https://github.com/Daniel88dev/fenro-dashboard/tree/main/skills --skill fenro-task` when it is missing) now picks up their tasks with these skills.
