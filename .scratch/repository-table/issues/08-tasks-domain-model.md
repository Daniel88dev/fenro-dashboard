# What does a task carry between sessions?

Type: grilling
Status: open
Blocked by: 07
Part of: [map](../map.md)

## Question

This is the other half of the product, and the half with real invariants. The
prototypes show a task with an id, a title, a state
(`running` / `paused` / `blocked` / `ready`), a last-activity line naming a
session (`Session 1 running, 6 min in`), and **a count of context items**. That
count is the product's whole premise made visible.

- What is a **context item**? A decision, a file path, a link, a message, a
  finding? The prototype shows `3 decisions recorded so far` and
  `editing src/modules/github-insights/ui`, which suggests more than one kind.
  Are they one polymorphic value object or several?
- What is a **session**? An entity inside the `Task` aggregate, or an aggregate
  of its own with the task as a reference? The rule "only one session may run at
  a time on a task" is a real invariant and decides this.
- Is the **handoff brief** stored or derived? One artboard from the first
  prototype round composed it by ticking context items in or out, which implies
  selection is state the user owns, not a pure projection.
- What is the task's **lifecycle**, and which transitions are illegal? `blocked`
  and `ready` are not the same kind of thing as `running` and `paused` — one is
  about the world, one is about a session.
- How does a task **reference a repository**, and a pull request, when
  _Make a task from this_ creates one? See ticket 09.
- Do context items accumulate append-only? If a later session can rewrite what an
  earlier one recorded, the handoff stops being trustworthy.

Call `domain-modeling` alongside `grilling`. This is the ticket most likely to
spawn several more.
