# Issue tracker: Local Markdown

Issues and specs for this repo live as markdown files in `.scratch/`.

This file is the minimum the `mattpocock-skills` engineering skills need in order
to know where to write. It was written by hand rather than by a full
`/setup-matt-pocock-skills` run, which would also settle triage labels and the
domain-doc layout and add an `## Agent skills` block to `CLAUDE.md`. Run that
skill when you want the rest — or to move issues to GitHub Issues instead, which
is the default posture for a repo with a GitHub remote and the better home for a
wayfinder map, since GitHub renders blocking relationships natively.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at
  `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`, never a
  single combined tickets file
- Triage state is recorded as a `Status:` line near the top of each issue file
- Comments and conversation history append to the bottom of the file under a
  `## Comments` heading

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/`, creating the directory if
needed.

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a file with one **child** file per ticket.

- **Map**: `.scratch/<effort>/map.md` (the Destination / Notes / Decisions-so-far
  / Not-yet-specified / Out-of-scope body).
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md`, numbered from `01`,
  with the question in the body. A `Type:` line records the ticket type
  (`research`/`prototype`/`grilling`/`task`); a `Status:` line records
  `open`/`claimed`/`resolved`.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked
  when every file it lists is `resolved`.
- **Frontier**: scan `.scratch/<effort>/issues/` for files that are open,
  unblocked and unclaimed; first by number wins.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set
  `Status: resolved`, then append a context pointer (gist + link) to the map's
  Decisions-so-far.

Efforts in flight: [the repository table](../../.scratch/repository-table/map.md).
