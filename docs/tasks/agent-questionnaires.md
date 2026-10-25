# Agent questionnaires

An agent that needs the person to settle something (a design direction, a scope
call, a preference) posts a **round of questions** to the task. The person
answers in a drawer on the task page; the agent reads the answers, either at
once while it waits or in the next session's brief.

Research, with the options that were weighed and rejected:
`/mnt/project-files/agent-questionnaires/research.md` (project files). Design:
direction A of the [canvas](https://claude.ai/artifact/7wCLBKgYHp4axhFogssLn3).

## The model

`Questionnaire` is its own aggregate in the tasks context
(`src/modules/tasks/domain/questionnaire.ts`), not part of `Task`: a round
changes on its own schedule and the person answering it must not race an agent
writing notes to the task.

- A round has a number per task (1, 2, 3…), a title, an optional intro, and 1
  to 10 questions. Status is `open`, then `answered` or `withdrawn`, never back.
- A question is `single`, `multiple` or `text`. Choice questions take 2 to 6
  suggestions; a single-choice question recommends at most one. Every question
  also takes a free-text answer, so an "Other" suggestion is dropped.
- Ids are optional: questions default to `q1`, `q2`…, suggestions to `a`, `b`….
- Pictures (up to 4 per question) are the task's own pictures, attached with
  `attach_picture` first; a suggestion can carry one picture. Each picture is
  used once per round. Pictures linked to a round are left out of the task's
  Pictures section.
- Only a person answers, once. Answers keep question order; a question with no
  choice, text or picture is stored as `skipped`.
- A task holds one open round at a time. While it is open and no session is
  live, the task's derived state is **blocked**, so it leaves the ready queue.
- Posting follows the task's claim: an agent cannot post while another agent
  holds the task. A repeated post with the same id is a no-op.

## Storage

Two tables in `src/modules/tasks/infrastructure/persistence/schema.ts`
(migration `0003_task_questionnaires`):

- `task_questionnaire`: one row per round, questions and answers as `jsonb`,
  status, counts and a `version` for optimistic concurrency. A unique index on
  `(task_id, number)` and a partial unique index on `task_id` where
  `status = 'open'` back the rules above.
- `task_questionnaire_picture`: links a round to `task_picture` rows, with the
  question, the suggestion (or none for the question's own picture) and whether
  it belongs to the question or the answer.

## MCP tools

| Tool                 | What it does                                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------------- |
| `ask_questions`      | Post a round to a task. Returns `T-42/3`, the task URL with `?round=3`, and `wait_until`                        |
| `get_answers`        | Read a round, by `questionnaire: "T-42/3"` or the latest on a `task`: choices by label, text, pictures, skipped |
| `wait_for_answers`   | Long-poll: returns as soon as the round is answered or withdrawn, or after `seconds` (default 45, at most 50)   |
| `withdraw_questions` | Take back an open round the agent no longer needs, with a reason                                                |

`get_task` and `start_task` list the task's rounds, and `new_answers` carries
rounds answered since the latest handoff, so a paused agent picks them up in
its next session.

### Waiting, and why not WebSockets

App Runner offers no WebSockets and cuts a request at 120 s, and MCP clients
do not hold sockets open for a tool anyway. `wait_for_answers` therefore waits
inside one request, at most 50 s, and the agent calls it again while the
person may be at hand. The budget is 15 minutes from posting, computed from
`posted_at` rather than stored; after it the agent should `finish_session`
with outcome `paused`.

The wait is woken in-process (`InProcessAnswerNotifications`, one per process
on `globalThis`, because Next bundles route handlers and server actions
separately). On more than one instance an answer saved on another instance is
seen when the waiting request re-reads the round at the end of its window, so
the worst case is one window late. Nothing polls the site between calls.

## Screens

- **Task page**: a "N questions for you" chip by the title opens the open
  round; the side column (above the journal on phones) lists every round,
  newest first, with its state, count and a line on who answered or why it
  was withdrawn. `?round=N` opens that round, which is the link agents give.
- **Drawer**: 520 px on the right under the top bar, a full sheet on phones,
  non-modal so the task stays readable. Options are buttons with
  `aria-pressed`; suggestions with pictures show as a grid whose tiles open the
  picture viewer with a Choose button. Each question has a Markdown answer box
  and Add picture (up to 4). Closing with input asks "Discard your answers?";
  submitting with gaps names the unanswered questions. Discarding removes
  pictures uploaded in the drawer. Answered and withdrawn rounds open
  read-only.
- **List and board**: a "N questions" chip on list rows and "N questions for
  you" on board cards; a "Needs my answer" filter (`needs=answer`) next to
  Spaces, Labels and Repository, shown while any task waits on an answer.
