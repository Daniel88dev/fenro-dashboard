# Matt Pocock's skills

Step 3 of [`fenro-setup`](SKILL.md). Matt Pocock's skills (`mattpocock/skills`) bring grilling, specs, tickets, TDD and debugging; his engineering skills read their issue tracker from `docs/agents/issue-tracker.md`.

1. **Install, when they are missing.** Offer them; the person may decline, which ends this step. Install for the agent in use:
   - Claude Code: `claude plugin install mattpocock-skills@claude-plugins-official` (updates itself).
   - Any other agent: `npx skills@latest add mattpocock/skills`, choosing the skills, and include `setup-matt-pocock-skills`.

   A freshly installed skill or plugin appears in the next session. If the person needs to restart before `/setup-matt-pocock-skills` is available, continue `fenro-setup` from step 4 now and come back to this step after the restart.

2. **Offer Fenro as their issue tracker.** Recommend it: tickets, wayfinder maps and grilling rounds then live with the rest of the person's tasks instead of in `.scratch/` files. On yes, write `docs/agents/issue-tracker.md` from [`issue-tracker-fenro.md`](issue-tracker-fenro.md), filling in the repository and space. On no, leave his tracker choice to his setup.

3. **Run `/setup-matt-pocock-skills`** (or ask the person to, when only they can invoke it). When it asks about the issue tracker, answer **Other: Fenro**, already described in `docs/agents/issue-tracker.md`, so it keeps that file; its remaining questions (triage labels, domain docs) are its own. When it asks about triage labels with Fenro as the tracker, the labels it records are Fenro labels: a task carries them, and `save_task` creates any that are missing.

Done when `docs/agents/issue-tracker.md` names its tracker, or the person declined.
