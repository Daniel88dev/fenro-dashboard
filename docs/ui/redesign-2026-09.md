# Redesign, September 2026

The first design pass run through the `design-taste-frontend` skill
(see [design-taste.md](./design-taste.md)). Prototypes only: nothing here is
implemented until Daniel picks a direction.

Prototypes: [Fenro redesign prototypes](https://claude.ai/artifact/Uj2hLnvUy6X9dYrzzAdDgr),
two pages on one canvas. All data on them is invented.

## Design read

Reading this as: a redesign, preserving the brand, of a dense developer
dashboard and agent task list for one technical owner, with a calm
Linear-style tool language, leaning toward Tailwind v4 tokens, Geist and
Geist Mono, and motion only for state changes.

Dials: current app reads as `VARIANCE 2 / MOTION 2 / DENSITY 7`. Direction A
keeps that and adds one step of motion (`2 / 3 / 7`). Direction B moves
layout further (`4 / 3 / 7`).

The skill says dashboards are out of scope and points them at Fluent,
Carbon or Primer. We keep our own components and apply the rest of the skill;
the reasons are in design-taste.md.

## Audit of what is on main

Keep:

- The repository table with counts that expand in place, several rows open at
  once, and the Tasks column. Approved on 2026-09-20 and still the core.
- The palette and its meanings (teal pull requests, rust issues, amber running)
  and dark mode through tokens.
- Geist Mono for every name, number, key and SHA.

Retire:

- **The `/` page** is the scaffold's "bounded contexts" list, with zinc and
  `dark:` classes outside the palette. Send `/` to Repositories (or Sign in).
- **Middle-dot strings.** The header totals, pull request meta and task meta
  are joined with `·`, several per line. Replace with columns, labelled stats
  or plain sentences.
- **Boxes in boxes.** An expanded panel is a bordered row list inside a
  bordered panel inside the bordered table; the task page is seven bordered
  cards. One container per level, hairlines inside it.
- **Mixed radii.** 12, 9 and 6 px plus full pills with no rule. New rule:
  containers 12, controls 8, chips 6, filter pills full.
- **Phone width.** The top bar overflows and the table's fixed columns do not
  collapse.
- **Five status buttons** on a task (Move to todo, backlog, review, done,
  cancel) at equal weight. One primary action, one secondary, the rest in a
  menu.
- **The latest handoff** sits inside the Journal card below the description.
  It is the context an agent leaves for the next session and should lead.
- **`body` falls back to Arial** in `globals.css`, and the leftover
  `--background` / `--foreground` variables are outside the palette.
- **An em-dash** as the empty duration in the checks list.

## Direction A: Refined

Same top bar and page layouts, cleaned up across every screen: labelled stats
instead of the dotted totals line, a rate-limit banner instead of red text
squeezed into the header, one-level panels with a 2 px underline marking the
open count, a row menu for Unwatch, updates that keep the current numbers on screen, an empty state that
explains itself, tasks grouped by state, a task page led by the latest
handoff with properties in a side list, a settings page with an Account
section, and phone layouts where the nav becomes a three-button row.

## Direction B: Focus

A left rail replaces the top bar, and the home page opens with a **Needs you**
list: pull requests waiting on your review, your failing checks, tasks where
an agent is waiting on your answer, fresh handoffs and untriaged issues,
oldest first. The repository table follows below. The task page puts the
brief on the left and a live session log with a reply box on the right, so
answering an agent is one step. Everything else would follow A.

## Pre-flight

Checked against the skill's section 14, minus the marketing-page rows. No
em-dashes or en-dashes in visible copy; one theme per page following the OS;
semantic colours only, no decorative accent; one radius rule; primary
buttons pass 4.5:1 in both schemes; labels above inputs; updating, empty and
error states drawn; icons from Phosphor, not hand-drawn; dots only for a live
agent session; motion only on the expanding caret, behind
`prefers-reduced-motion`.

## Feedback so far

- 2026-09-24, Daniel on the pull request panel: the number itself should link
  to the pull request on GitHub instead of a separate "Review on GitHub"
  button. Done on the canvas for pull request and issue numbers; the rest of
  the row still toggles the checks.
- 2026-09-24, Daniel on loading: no skeleton loaders. While data updates, the
  current data stays on screen and a loader only says an update is running.
  The board now shows the table as it was, a bar along the table, "Updating 2
  of 4 from GitHub" in the header and a turning icon on each row in flight.
- 2026-09-24, Daniel on New task: a field whose text is too long grows to a
  second line instead of clipping. Source now wraps.
