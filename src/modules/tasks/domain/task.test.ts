import { describe, expect, it } from "vitest";

import { isErr, unwrap } from "@/shared/domain";

import type { Actor } from "./actor";
import { ExternalReference } from "./external-reference";
import { SESSION_LEASE_MS } from "./session";
import { Task, type NewTask, type TaskSurroundings } from "./task";

const t0 = new Date("2026-09-23T10:00:00Z");
const later = (minutes: number) => new Date(t0.getTime() + minutes * 60_000);

const claude: Actor = { kind: "agent", id: "token-1", name: "claude-code" };
const cursor: Actor = { kind: "agent", id: "token-2", name: "cursor" };
const daniel: Actor = { kind: "human", id: "user-1", name: "Daniel" };

const clear: TaskSurroundings = { openBlockers: [], openSubtasks: [] };

function aTask(overrides: Partial<NewTask> = {}): Task {
  return unwrap(
    Task.create({
      id: "task-1",
      ownerId: "user-1",
      number: 7,
      title: "Make the settlement reducer two aggregates",
      author: daniel,
      now: t0,
      ...overrides,
    }),
  );
}

function started(task: Task, actor: Actor = claude, at: Date = t0): Task {
  unwrap(task.startSession(actor, clear, at));
  return task;
}

describe("Task", () => {
  describe("creation", () => {
    it("starts as todo with a key and records that it was created", () => {
      const task = aTask();

      expect(task.key).toBe("T-7");
      expect(task.status).toBe("todo");
      expect(task.pullDomainEvents().map((event) => event.name)).toEqual([
        "tasks.task-created",
      ]);
    });

    it("refuses a task without a title", () => {
      const result = Task.create({
        id: "task-1",
        ownerId: "user-1",
        number: 1,
        title: "   ",
        author: daniel,
        now: t0,
      });

      expect(isErr(result) && result.error.code).toBe("invalid-task");
    });

    it("numbers its acceptance criteria and normalises its labels", () => {
      const task = aTask({
        criteria: ["Tests pass", "", "Docs updated"],
        labels: ["Backend", "backend", "ddd", "Needs review"],
      });

      expect(task.state.criteria.map((c) => [c.number, c.text])).toEqual([
        [1, "Tests pass"],
        [2, "Docs updated"],
      ]);
      expect(task.state.labels).toEqual(["backend", "ddd", "needs-review"]);
    });

    it("keeps one source among its references", () => {
      const task = aTask({
        references: [
          unwrap(
            ExternalReference.fromUrl("https://github.com/o/r/issues/1", {
              isSource: true,
            }),
          ),
          unwrap(
            ExternalReference.fromUrl(
              "https://acme.atlassian.net/browse/PAY-4",
              {
                isSource: true,
              },
            ),
          ),
        ],
      });

      expect(
        task.state.references.map((reference) => [
          reference.key,
          reference.isSource,
        ]),
      ).toEqual([
        ["o/r#1", false],
        ["PAY-4", true],
      ]);
    });
  });

  describe("sessions", () => {
    it("claims the task for one agent and moves it in progress", () => {
      const task = aTask();

      const session = unwrap(task.startSession(claude, clear, t0));

      expect(session.number).toBe(1);
      expect(task.status).toBe("in_progress");
      expect(task.liveSession(t0)?.id).toBe(session.id);
    });

    it("refuses a second agent while the first holds the task", () => {
      const task = started(aTask());

      const result = task.startSession(cursor, clear, later(30));

      expect(isErr(result) && result.error.code).toBe("task-claimed");
    });

    it("resumes the same session when its own agent starts it again", () => {
      const task = started(aTask());
      const first = task.liveSession(t0)!;

      const again = unwrap(task.startSession(claude, clear, later(30)));

      expect(again.id).toBe(first.id);
      expect(again.lastSeenAt).toEqual(later(30));
    });

    it("lets another agent take over once the lease has lapsed", () => {
      const task = started(aTask());
      const lapsed = new Date(t0.getTime() + SESSION_LEASE_MS);

      const session = unwrap(task.startSession(cursor, clear, lapsed));

      expect(session.number).toBe(2);
      expect(task.sessions[0]?.outcome).toBe("lapsed");
    });

    it("keeps the lease alive while its agent keeps working", () => {
      const task = started(aTask());
      unwrap(task.note("note", "Found the reducer", claude, later(100)));

      const result = task.startSession(
        cursor,
        clear,
        new Date(t0.getTime() + SESSION_LEASE_MS),
      );

      expect(isErr(result) && result.error.code).toBe("task-claimed");
    });

    it("will not start while blocked by an open task", () => {
      const result = aTask().startSession(
        claude,
        { openBlockers: ["T-3"], openSubtasks: [] },
        t0,
      );

      expect(isErr(result) && result.error.code).toBe("task-blocked");
      expect(isErr(result) && result.error.message).toContain("T-3");
    });

    it("will not start while on hold", () => {
      const task = aTask();
      unwrap(task.putOnHold("Waiting on finance", daniel, t0));

      const result = task.startSession(claude, clear, t0);

      expect(isErr(result) && result.error.code).toBe("task-on-hold");
    });

    it("will not start a task in the backlog", () => {
      const result = aTask({ status: "backlog" }).startSession(
        claude,
        clear,
        t0,
      );

      expect(isErr(result) && result.error.code).toBe("task-not-ready");
      expect(isErr(result) && result.error.message).toContain("backlog");
    });

    it("will not start a todo task waiting on open sub-tasks", () => {
      const result = aTask().startSession(
        claude,
        { openBlockers: [], openSubtasks: ["T-8"] },
        t0,
      );

      expect(isErr(result) && result.error.code).toBe("open-subtasks");
      expect(isErr(result) && result.error.message).toContain("T-8");
    });

    it("resumes an in-progress task that has gained sub-tasks", () => {
      const task = aTask();
      const first = unwrap(task.startSession(claude, clear, t0));
      unwrap(
        task.finishSession(
          claude,
          { outcome: "paused", summary: "Split into sub-tasks" },
          clear,
          later(10),
        ),
      );

      const again = task.startSession(
        cursor,
        { openBlockers: [], openSubtasks: ["T-8"] },
        later(20),
      );

      expect(again.ok && again.value.number).toBe(first.number + 1);
    });

    it("will not start a finished task", () => {
      const task = aTask();
      unwrap(task.changeStatus("cancelled", daniel, clear, t0));

      const result = task.startSession(claude, clear, t0);

      expect(isErr(result) && result.error.code).toBe("invalid-transition");
    });
  });

  describe("finishing a session", () => {
    it("requires a handoff summary", () => {
      const task = started(aTask());

      const result = task.finishSession(
        claude,
        { outcome: "paused", summary: " " },
        clear,
        later(10),
      );

      expect(isErr(result) && result.error.code).toBe("invalid-task");
      expect(task.liveSession(later(10))).toBeDefined();
    });

    it("writes the summary to the journal as a handoff", () => {
      const task = started(aTask());
      task.pullNewJournalEntries();

      unwrap(
        task.finishSession(
          claude,
          { outcome: "paused", summary: "Split done, tests left" },
          clear,
          later(10),
        ),
      );

      const [handoff] = task.pullNewJournalEntries();
      expect(handoff?.kind).toBe("handoff");
      expect(handoff?.text).toBe("Split done, tests left");
      expect(handoff?.sessionId).toBe(task.sessions[0]?.id);
      expect(task.status).toBe("in_progress");
      expect(task.liveSession(later(10))).toBeUndefined();
      expect(task.sessions[0]?.outcome).toBe("paused");
    });

    it("is not done while sub-tasks are open", () => {
      const task = started(aTask());

      const result = task.finishSession(
        claude,
        { outcome: "done", summary: "All done" },
        { openBlockers: [], openSubtasks: ["T-8"] },
        later(10),
      );

      expect(isErr(result) && result.error.code).toBe("open-subtasks");
    });

    it("is not done while an acceptance criterion is unmet", () => {
      const task = started(aTask({ criteria: ["Tests pass", "Docs"] }));
      unwrap(task.checkCriterion(1, true, "CI run 12", claude, later(5)));

      const result = task.finishSession(
        claude,
        { outcome: "done", summary: "All done" },
        clear,
        later(10),
      );

      expect(isErr(result) && result.error.code).toBe("unmet-criteria");
      expect(isErr(result) && result.error.message).toContain("2. Docs");
    });

    it("completes the task when everything is met", () => {
      const task = started(aTask({ criteria: ["Tests pass"] }));
      unwrap(task.checkCriterion(1, true, "CI run 12", claude, later(5)));

      unwrap(
        task.finishSession(
          claude,
          { outcome: "done", summary: "Merged" },
          clear,
          later(10),
        ),
      );

      expect(task.status).toBe("done");
      expect(task.state.completedAt).toEqual(later(10));
    });

    it("puts the task on hold when the agent is blocked", () => {
      const task = started(aTask());

      unwrap(
        task.finishSession(
          claude,
          {
            outcome: "blocked",
            summary: "Need a decision",
            reason: "Finance to pick a rounding rule",
          },
          clear,
          later(10),
        ),
      );

      expect(task.state.hold?.reason).toBe("Finance to pick a rounding rule");
    });

    it("gives the task back to the queue when released", () => {
      const task = started(aTask());

      unwrap(
        task.finishSession(
          claude,
          { outcome: "released", summary: "Not for me" },
          clear,
          later(10),
        ),
      );

      expect(task.status).toBe("todo");
    });

    it("refuses an agent that holds no session", () => {
      const task = started(aTask());

      const result = task.finishSession(
        cursor,
        { outcome: "done", summary: "Done" },
        clear,
        later(10),
      );

      expect(isErr(result) && result.error.code).toBe("no-live-session");
    });

    it("lets an agent finish its own lapsed session nobody took over", () => {
      const task = started(aTask());

      unwrap(
        task.finishSession(
          claude,
          { outcome: "paused", summary: "Back after a long build" },
          clear,
          new Date(t0.getTime() + SESSION_LEASE_MS + 1),
        ),
      );

      expect(task.sessions[0]?.outcome).toBe("paused");
    });
  });

  describe("status", () => {
    it("sends the session holder to finish its session instead", () => {
      const task = started(aTask());

      const result = task.changeStatus("in_review", claude, clear, later(5));

      expect(isErr(result) && result.error.code).toBe("invalid-transition");
    });

    it("refuses another agent while a session is live", () => {
      const task = started(aTask());

      const result = task.changeStatus("cancelled", cursor, clear, later(5));

      expect(isErr(result) && result.error.code).toBe("task-claimed");
    });

    it("lets a person override a live session", () => {
      const task = started(aTask());

      unwrap(task.changeStatus("cancelled", daniel, clear, later(5)));

      expect(task.status).toBe("cancelled");
      expect(task.sessions[0]?.outcome).toBe("cancelled");
    });

    it("reopens a finished task only to todo or backlog", () => {
      const task = aTask();
      unwrap(task.changeStatus("done", daniel, clear, t0));

      expect(isErr(task.changeStatus("in_review", daniel, clear, t0))).toBe(
        true,
      );
      unwrap(task.changeStatus("todo", daniel, clear, t0));
      expect(task.status).toBe("todo");
      expect(task.state.completedAt).toBeNull();
    });

    it("records each status change", () => {
      const task = aTask();
      task.pullDomainEvents();

      unwrap(task.changeStatus("backlog", daniel, clear, t0));

      expect(task.pullDomainEvents().map((event) => event.name)).toEqual([
        "tasks.task-status-changed",
      ]);
    });
  });

  describe("journal", () => {
    it("appends entries with their author and session", () => {
      const task = started(aTask());
      task.pullNewJournalEntries();

      unwrap(task.note("decision", "Keep the reducer pure", claude, later(1)));
      unwrap(task.note("question", "Who owns refunds?", daniel, later(2)));

      const entries = task.pullNewJournalEntries();
      expect(entries.map((entry) => [entry.kind, entry.author.name])).toEqual([
        ["decision", "claude-code"],
        ["question", "Daniel"],
      ]);
      expect(entries[0]?.sessionId).toBe(task.sessions[0]?.id);
      expect(entries[1]?.sessionId).toBeNull();
    });
  });

  describe("criteria", () => {
    it("keeps numbers stable when one is removed and another added", () => {
      const task = aTask({ criteria: ["One", "Two"] });

      unwrap(task.removeCriterion(1, daniel, t0));
      unwrap(task.addCriteria(["Three"], daniel, t0));

      expect(task.state.criteria.map((c) => c.number)).toEqual([2, 3]);
    });

    it("stops another agent from checking criteria on a claimed task", () => {
      const task = started(aTask({ criteria: ["One"] }));

      const result = task.checkCriterion(1, true, null, cursor, later(1));

      expect(isErr(result) && result.error.code).toBe("task-claimed");
    });
  });

  describe("links", () => {
    it("adds a link once however often it is asked", () => {
      const task = aTask();

      unwrap(task.link("blocked-by", "task-2", daniel, t0));
      unwrap(task.link("blocked-by", "task-2", daniel, t0));

      expect(task.links).toEqual([{ kind: "blocked-by", taskId: "task-2" }]);
    });

    it("refuses a link to itself", () => {
      expect(isErr(aTask().link("relates-to", "task-1", daniel, t0))).toBe(
        true,
      );
    });

    it("replaces a reference to the same target", () => {
      const task = aTask();
      const url = "https://github.com/o/r/pull/9";

      task.attach(unwrap(ExternalReference.fromUrl(url)), daniel, t0);
      task.attach(
        unwrap(ExternalReference.fromUrl(`${url}/files`, { title: "The PR" })),
        daniel,
        t0,
      );

      expect(task.state.references).toHaveLength(1);
      expect(task.state.references[0]?.title).toBe("The PR");
    });
  });
});

describe("Task epics", () => {
  it("creates an epic that sits at the top", () => {
    expect(aTask({ kind: "epic" }).kind).toBe("epic");
    expect(aTask().kind).toBe("task");

    const nested = Task.create({
      id: "task-1",
      ownerId: "user-1",
      number: 7,
      title: "Ship tasks v2",
      author: daniel,
      now: t0,
      kind: "epic",
      parentId: "task-0",
    });
    expect(isErr(nested) && nested.error.code).toBe("invalid-task");
  });

  it("refuses to put an epic under another task", () => {
    const epic = aTask({ kind: "epic" });

    const moved = epic.moveUnder("task-0", daniel, t0);

    expect(isErr(moved)).toBe(true);
    expect(epic.state.parentId ?? null).toBeNull();
  });

  it("turns a top-level task into an epic and records it", () => {
    const task = aTask();
    task.pullDomainEvents();

    unwrap(task.changeKind("epic", daniel, later(1)));

    expect(task.kind).toBe("epic");
    expect(task.pullDomainEvents().map((event) => event.name)).toEqual([
      "tasks.task-kind-changed",
    ]);
  });

  it("does not make a sub-task an epic while it has a parent", () => {
    const task = aTask({ parentId: "task-0" });

    const changed = task.changeKind("epic", daniel, t0);

    expect(isErr(changed) && changed.error.code).toBe("invalid-task");
    expect(task.kind).toBe("task");
  });

  it("does not make a task an epic while an agent is working on it", () => {
    const task = aTask();
    unwrap(task.startSession(claude, clear, t0));

    const changed = task.changeKind("epic", daniel, later(1));

    expect(isErr(changed) && changed.error.code).toBe("task-claimed");
    expect(task.kind).toBe("task");
  });

  it("turns an epic back into a task", () => {
    const epic = aTask({ kind: "epic" });
    epic.pullDomainEvents();

    unwrap(epic.changeKind("task", daniel, later(1)));

    expect(epic.kind).toBe("task");
    expect(epic.pullDomainEvents().map((event) => event.name)).toEqual([
      "tasks.task-kind-changed",
    ]);
  });

  it("does not let anyone start a session on an epic", () => {
    const epic = aTask({ kind: "epic" });

    const result = epic.startSession(claude, clear, t0);

    expect(isErr(result) && result.error.code).toBe("invalid-transition");
  });
});

describe("Task moved into progress by hand", () => {
  it("lets a person move a task into progress without a session", () => {
    const task = aTask();

    unwrap(task.changeStatus("in_progress", daniel, clear, t0));

    expect(task.status).toBe("in_progress");
    expect(task.liveSession(t0)).toBeUndefined();
  });

  it("tells an agent to start the task instead", () => {
    const task = aTask();

    const result = task.changeStatus("in_progress", claude, clear, t0);

    expect(isErr(result) && result.error.code).toBe("invalid-transition");
    expect(task.status).toBe("todo");
  });
});

describe("Task assignee", () => {
  const members = [
    { userId: "user-1", login: "Daniel88dev" },
    { userId: "user-2", login: "mira" },
  ];
  const groupTask = () =>
    aTask({ ownerId: "group-hal", keyPrefix: "HAL", number: 3 });

  it("leaves a new group task unassigned", () => {
    expect(groupTask().state.assignee).toBeNull();
  });

  it("assigns a group task to a member by login, ignoring case and @", () => {
    const task = groupTask();
    task.pullDomainEvents();

    unwrap(task.assign("@MIRA", members, daniel, later(1)));

    expect(task.state.assignee).toEqual({ userId: "user-2", login: "mira" });
    expect(task.assigneeId).toBe("user-2");
    expect(task.pullDomainEvents()).toMatchObject([
      { name: "tasks.task-assignee-changed", from: null, to: "user-2" },
    ]);
  });

  it("unassigns a group task and records it", () => {
    const task = groupTask();
    unwrap(task.assign("mira", members, daniel, t0));
    task.pullDomainEvents();

    unwrap(task.assign(null, members, daniel, later(1)));

    expect(task.state.assignee).toBeNull();
    expect(task.pullDomainEvents()).toMatchObject([
      { from: "user-2", to: null },
    ]);
  });

  it("records nothing when the assignee stays the same", () => {
    const task = groupTask();
    unwrap(task.assign("mira", members, daniel, t0));
    task.pullDomainEvents();

    unwrap(task.assign("Mira", members, daniel, later(1)));

    expect(task.pullDomainEvents()).toEqual([]);
  });

  it("refuses someone outside the group", () => {
    const result = groupTask().assign("stranger", members, daniel, t0);

    expect(isErr(result) && result.error.code).toBe("invalid-assignee");
  });

  it("keeps a personal task with its owner", () => {
    const task = aTask();

    const result = task.assign("mira", members, daniel, t0);

    expect(isErr(result) && result.error.code).toBe("invalid-assignee");
    expect(task.assigneeId).toBe("user-1");
  });
});
