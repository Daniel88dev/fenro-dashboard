import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const push = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, prefetch: vi.fn(), back: vi.fn() }),
}));

import type {
  TaskBrief,
  TaskList as TaskListResult,
  TaskListItem,
} from "@/modules/tasks/application/queries/read-models";

import { TaskDetail } from "./task-detail";
import { TaskDialogContent } from "./task-dialog";
import { NewTaskForm, type TaskActions } from "./task-forms";
import { TaskList } from "./task-list";
import { TasksPanel } from "./tasks-panel";

const item: TaskListItem = {
  key: "T-2",
  kind: "task",
  title: "Fix the lint job",
  status: "todo",
  state: "blocked",
  priority: "high",
  labels: [],
  repository: "Daniel88dev/fenro-dashboard",
  parent: "T-1",
  epic: null,
  progress: null,
  assignee: null,
  blockedBy: ["T-4"],
  hold: null,
  workedOnBy: null,
  subtasks: { open: 0, total: 0 },
  criteria: { met: 1, total: 2 },
  journalEntries: 3,
  questions: 0,
  updatedAt: "2026-09-24T10:00:00.000Z",
};

const brief: TaskBrief = {
  key: "T-2",
  id: "00000000-0000-4000-8000-000000000002",
  assignee: null,
  kind: "task",
  title: "Fix the lint job",
  status: "todo",
  state: "ready",
  priority: "none",
  labels: [],
  repository: null,
  description: "",
  acceptanceCriteria: [
    { number: 1, text: "CI is green", met: true, evidence: "Run 12" },
    { number: 2, text: "Reviewed", met: false, evidence: null },
  ],
  hold: null,
  parent: {
    key: "T-1",
    kind: "task",
    title: "Ship it",
    status: "todo",
    state: "waiting",
  },
  epic: null,
  progress: null,
  subtasks: [],
  blockedBy: [
    {
      key: "T-4",
      kind: "task",
      title: "Upgrade",
      status: "done",
      state: "done",
    },
  ],
  blocks: [
    {
      key: "T-5",
      kind: "task",
      title: "Release",
      status: "todo",
      state: "blocked",
    },
  ],
  relatesTo: [],
  discoveredFrom: null,
  discovered: [],
  references: [],
  session: null,
  sessions: 0,
  latestHandoff: {
    kind: "handoff",
    text: "Lint passes locally; CI still queued.",
    author: "Claude Code",
    session: 1,
    recordedAt: "2026-09-24T09:00:00.000Z",
  },
  decisions: [],
  recentJournal: [
    {
      kind: "decision",
      text: "Pin eslint.",
      author: "Claude Code",
      session: 1,
      recordedAt: "2026-09-24T08:00:00.000Z",
    },
    {
      kind: "handoff",
      text: "Lint passes locally; CI still queued.",
      author: "Claude Code",
      session: 1,
      recordedAt: "2026-09-24T09:00:00.000Z",
    },
  ],
  journalEntries: 2,
  pictures: [],
  questionnaires: [],
  skills: [],
  createdAt: "2026-09-24T07:00:00.000Z",
  updatedAt: "2026-09-24T09:00:00.000Z",
};

function actions(overrides: Partial<TaskActions> = {}): TaskActions {
  const saved = vi.fn(async () => ({ error: null, saved: 1 }));
  return {
    create: saved,
    update: saved,
    labels: saved,
    assign: saved,
    edit: saved,
    note: saved,
    checkCriterion: saved,
    changeStatus: saved,
    link: saved,
    removePicture: saved,
    answer: saved,
    kind: saved,
    ...overrides,
  };
}

describe("TaskList", () => {
  const list: TaskListResult = { total: 1, tasks: [item] };

  it("links each task and says what holds it back", () => {
    render(
      <TaskList
        list={list}
        filter={{ view: "open", repository: "", text: "", labels: [] }}
      />,
    );

    const row = screen.getByRole("link", { name: /Fix the lint job/ });
    expect(row).toHaveAttribute("href", "/tasks/T-2");
    expect(row).toHaveTextContent("sub-task of T-1");
    expect(row).toHaveTextContent("blocked by T-4");
    expect(row).toHaveTextContent("1 of 2 criteria met");
  });

  it("keeps the repository when switching views, and starts new tasks there", () => {
    render(
      <TaskList
        list={list}
        filter={{
          view: "open",
          repository: "Daniel88dev/fenro-dashboard",
          text: "",
          labels: [],
        }}
      />,
    );

    expect(screen.getByRole("link", { name: /^Blocked/ })).toHaveAttribute(
      "href",
      "/tasks?view=blocked&repository=Daniel88dev%2Ffenro-dashboard",
    );
    expect(screen.getByRole("link", { name: /^Open/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "New task" })).toHaveAttribute(
      "href",
      "/tasks/new?repository=Daniel88dev%2Ffenro-dashboard",
    );
  });

  it("groups the rows by what is happening to them, and counts each view", () => {
    render(
      <TaskList
        list={{
          total: 2,
          tasks: [item, { ...item, key: "T-3", state: "running" }],
        }}
        filter={{ view: "open", repository: "", text: "", labels: [] }}
        counts={{ open: 2, blocked: 1 }}
      />,
    );

    const groups = screen
      .getAllByRole("region")
      .map((group) => group.getAttribute("aria-label"));
    expect(groups).toEqual(["In progress", "Blocked"]);
    expect(screen.getByRole("link", { name: /^Blocked/ })).toHaveTextContent(
      "Blocked1",
    );
  });

  it("marks rows waiting on answers and filters down to them", () => {
    render(
      <TaskList
        list={{ total: 1, tasks: [{ ...item, questions: 3 }] }}
        filter={{ view: "blocked", repository: "", text: "", labels: [] }}
        needingAnswers={1}
      />,
    );

    expect(
      screen.getByRole("link", { name: /Fix the lint job/ }),
    ).toHaveTextContent("3 questions");
    const filter = screen.getByRole("link", { name: /Needs my answer/ });
    expect(filter).toHaveAttribute("aria-pressed", "false");
    expect(filter).toHaveAttribute("href", "/tasks?view=blocked&needs=answer");
  });

  it("filters by labels in the URL, keeping the rest of the filter", () => {
    render(
      <TaskList
        list={{ total: 1, tasks: [{ ...item, labels: ["bug"] }] }}
        filter={{
          view: "blocked",
          repository: "",
          text: "",
          labels: ["bug"],
        }}
        labels={[
          { name: "bug", colour: "red" },
          { name: "docs", colour: "blue" },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Labels: bug" }));
    const filters = screen.getByRole("dialog", { name: "Filter by label" });
    const bug = within(filters).getByRole("menuitemcheckbox", { name: /bug/ });
    const docs = within(filters).getByRole("menuitemcheckbox", {
      name: /docs/,
    });
    expect(bug).toHaveAttribute("aria-checked", "true");
    expect(docs).toHaveAttribute("aria-checked", "false");

    fireEvent.click(docs);
    expect(push).toHaveBeenLastCalledWith(
      "/tasks?view=blocked&labels=bug%2Cdocs",
      { scroll: false },
    );
    fireEvent.click(bug);
    expect(push).toHaveBeenLastCalledWith("/tasks?view=blocked", {
      scroll: false,
    });
    expect(
      screen.getByRole("link", { name: /Fix the lint job/ }),
    ).toHaveTextContent("bug");
  });

  it("finds a label by typing", () => {
    render(
      <TaskList
        list={list}
        filter={{ view: "open", repository: "", text: "", labels: [] }}
        labels={[
          { name: "bug", colour: "red", openTasks: 2 },
          { name: "docs", colour: "blue", openTasks: 1 },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Labels: any" }));
    fireEvent.change(screen.getByLabelText("Find a label"), {
      target: { value: "do" },
    });
    const filters = screen.getByRole("dialog", { name: "Filter by label" });
    expect(within(filters).getAllByRole("menuitemcheckbox")).toHaveLength(1);
    expect(
      within(filters).getByRole("menuitemcheckbox", { name: /docs/ }),
    ).toBeInTheDocument();
  });

  it("picks one repository from a searchable list, keeping the rest of the filter", () => {
    render(
      <TaskList
        list={list}
        filter={{
          view: "blocked",
          repository: "daniel88dev/fenro-dashboard",
          text: "",
          labels: ["bug"],
        }}
        repositories={[
          { name: "Daniel88dev/other", openTasks: 1 },
          { name: "Daniel88dev/fenro-dashboard", openTasks: 4 },
          { name: "nordwind/docs", openTasks: 1 },
        ]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Repository: Daniel88dev/fenro-dashboard",
      }),
    );
    const menu = screen.getByRole("dialog", { name: "Filter by repository" });
    const names = within(menu)
      .getAllByRole("link")
      .map((link) => link.textContent);
    expect(names).toEqual([
      "All repositories",
      "Daniel88dev/fenro-dashboard4",
      "Daniel88dev/other1",
      "nordwind/docs1",
    ]);
    expect(
      within(menu).getByRole("link", { name: /fenro-dashboard/ }),
    ).toHaveAttribute("aria-current", "true");
    expect(
      within(menu).getByRole("link", { name: "All repositories" }),
    ).toHaveAttribute("href", "/tasks?view=blocked&labels=bug");

    fireEvent.change(screen.getByLabelText("Find a repository"), {
      target: { value: "NORD" },
    });
    const found = within(menu).getAllByRole("link");
    expect(found).toHaveLength(1);
    expect(found[0]).toHaveAttribute(
      "href",
      "/tasks?view=blocked&repository=nordwind%2Fdocs&labels=bug",
    );
  });

  it("offers a repository from the URL that no task names, so it shows as picked", () => {
    render(
      <TaskList
        list={{ total: 0, tasks: [] }}
        filter={{
          view: "open",
          repository: "Daniel88dev/new-one",
          text: "",
          labels: [],
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Repository:/ }));
    expect(
      screen.getByRole("link", { name: /Daniel88dev\/new-one/ }),
    ).toHaveAttribute("aria-current", "true");
  });

  it("filters by space, and names the group on its tasks", () => {
    const spaces = [
      { prefix: "T", name: "Personal", kind: "personal" },
      { prefix: "HAL", name: "Halcyon Labs", kind: "group" },
      { prefix: "ORB", name: "Orbit", kind: "group" },
    ] as const;
    const item = list.tasks[0]!;
    render(
      <TaskList
        list={{ total: 1, tasks: [{ ...item, key: "HAL-7" }] }}
        filter={{ view: "open", repository: "", text: "", labels: [] }}
        spaces={spaces}
      />,
    );

    expect(screen.getByRole("link", { name: /HAL-7/ })).toHaveTextContent(
      "Halcyon Labs",
    );
    fireEvent.click(screen.getByRole("button", { name: "Spaces: All spaces" }));
    expect(
      screen.getByRole("radio", { name: "Only my personal tasks" }),
    ).toHaveAttribute("href", "/tasks?spaces=T");
    expect(screen.getByRole("checkbox", { name: /Orbit/ })).toHaveAttribute(
      "href",
      "/tasks?spaces=T%2CHAL",
    );
  });

  it("explains an empty view", () => {
    render(
      <TaskList
        list={{ total: 0, tasks: [] }}
        filter={{ view: "ready", repository: "", text: "", labels: [] }}
      />,
    );

    expect(screen.getByText(/Nothing is ready/)).toBeInTheDocument();
  });
});

describe("TaskDetail", () => {
  it("shows the handoff first and the journal once", () => {
    render(<TaskDetail task={brief} actions={actions()} />);

    const handoff = screen.getByRole("list", { name: "Latest handoff" });
    expect(handoff).toHaveTextContent("Lint passes locally");
    expect(
      screen.getAllByText("Lint passes locally; CI still queued."),
    ).toHaveLength(1);
    expect(screen.getByText("Pin eslint.")).toBeInTheDocument();
  });

  it("offers the moves a person can make, and removing only its own links", () => {
    render(<TaskDetail task={brief} actions={actions()} />);

    expect(
      screen.getByRole("button", { name: "Mark done" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Move to todo" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Remove blocked-by T-4" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Remove blocks T-5/ }),
    ).toBeNull();
    expect(screen.getByRole("link", { name: /Add sub-task/ })).toHaveAttribute(
      "href",
      "/tasks/new?parent=T-2",
    );
  });

  it("offers only reopening once a task is closed", () => {
    render(
      <TaskDetail
        task={{ ...brief, status: "done", state: "done" }}
        actions={actions()}
      />,
    );

    expect(screen.getByRole("button", { name: "Reopen" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark done" })).toBeNull();
    expect(screen.queryByRole("link", { name: /Add sub-task/ })).toBeNull();
  });

  it("shows the domain's refusal where the person acted", async () => {
    const changeStatus = vi.fn(async () => ({
      error: "T-2 has unmet acceptance criteria: 2. Reviewed.",
      saved: 0,
    }));
    render(<TaskDetail task={brief} actions={actions({ changeStatus })} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Mark done" }));
    });

    const form = screen.getByRole("form", { name: "Mark done" });
    expect(within(form).getByRole("alert")).toHaveTextContent(
      "unmet acceptance criteria",
    );
    const sent = changeStatus.mock.calls[0] as unknown as [unknown, FormData];
    expect(sent[1].get("task")).toBe("T-2");
    expect(sent[1].get("status")).toBe("done");
  });
});

describe("changing a task's kind", () => {
  it("says a sub-task leaves its parent before promoting it to an epic", async () => {
    const kind = vi.fn(async () => ({ error: null, saved: 1 }));
    render(<TaskDetail task={brief} actions={actions({ kind })} />);

    fireEvent.click(screen.getByRole("button", { name: "Promote to epic" }));
    const form = screen.getByRole("form", { name: "Promote to epic" });
    expect(form).toHaveTextContent(
      "It leaves T-1, because an epic has no parent.",
    );
    await act(async () => {
      fireEvent.click(within(form).getByRole("button", { name: "Promote" }));
    });

    const sent = kind.mock.calls[0] as unknown as [unknown, FormData];
    expect(sent[1].get("task")).toBe("T-2");
    expect(sent[1].get("kind")).toBe("epic");
    expect(sent[1].has("parent")).toBe(true);
  });

  it("keeps an epic's tasks under it when it turns into a task", async () => {
    const kind = vi.fn(async () => ({ error: null, saved: 1 }));
    const epic: TaskBrief = {
      ...brief,
      kind: "epic",
      parent: null,
      subtasks: [
        {
          key: "T-3",
          kind: "task",
          title: "Board",
          status: "todo",
          state: "ready",
        },
        {
          key: "T-4",
          kind: "task",
          title: "Labels",
          status: "todo",
          state: "ready",
        },
      ],
    };
    render(<TaskDetail task={epic} actions={actions({ kind })} />);

    fireEvent.click(screen.getByRole("button", { name: "Turn into a task" }));
    const form = screen.getByRole("form", { name: "Turn into a task" });
    expect(form).toHaveTextContent("Its 2 tasks stay under it as sub-tasks.");
    await act(async () => {
      fireEvent.click(
        within(form).getByRole("button", { name: "Turn into task" }),
      );
    });

    const sent = kind.mock.calls[0] as unknown as [unknown, FormData];
    expect(sent[1].get("kind")).toBe("task");
    expect(sent[1].has("parent")).toBe(false);
  });
});

describe("task dates", () => {
  it("shows when the task was made and last changed on the full page", () => {
    render(
      <TaskDetail
        task={brief}
        actions={actions()}
        now={new Date("2026-09-26T09:00:00Z")}
      />,
    );

    const created = screen.getByText("Created").nextElementSibling!;
    expect(created).toHaveTextContent("24 Sept 2026, 07:00 UTC · 2 d ago");
    expect(within(created as HTMLElement).getByText(/UTC/)).toHaveAttribute(
      "dateTime",
      "2026-09-24T07:00:00.000Z",
    );
    expect(
      screen.getByText("Last updated").nextElementSibling,
    ).toHaveTextContent("24 Sept 2026, 09:00 UTC · 2 d ago");
  });

  it("leaves them off the dialog", () => {
    render(<TaskDialogContent task={brief} actions={actions()} />);

    expect(screen.queryByText("Last updated")).not.toBeInTheDocument();
  });
});

describe("labels on a task", () => {
  it("saves as soon as a label is ticked, and makes new ones from what is typed", async () => {
    const labels = vi.fn(async () => ({ error: null, saved: 1 }));
    render(
      <TaskDetail
        task={{ ...brief, labels: ["bug"] }}
        actions={actions({ labels })}
        labels={[
          { name: "bug", colour: "red" },
          { name: "docs", colour: "blue" },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit labels" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("checkbox", { name: "docs" }));
    });
    let sent = labels.mock.calls.at(-1) as unknown as [unknown, FormData];
    expect(sent[1].getAll("labels")).toEqual(["bug", "docs"]);
    expect(sent[1].get("task")).toBe("T-2");

    fireEvent.change(screen.getByLabelText("Find or create a label"), {
      target: { value: "Needs Review" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Create/ }));
    });
    sent = labels.mock.calls.at(-1) as unknown as [unknown, FormData];
    expect(sent[1].getAll("labels")).toEqual(["bug", "docs", "needs-review"]);

    await act(async () => {
      fireEvent.click(screen.getByRole("checkbox", { name: "bug" }));
    });
    sent = labels.mock.calls.at(-1) as unknown as [unknown, FormData];
    expect(sent[1].getAll("labels")).toEqual(["docs", "needs-review"]);
  });
});

describe("assignees", () => {
  const you = { id: "user-1", login: "Daniel88dev" };
  const hal = {
    kind: "group" as const,
    name: "Halcyon Labs",
    members: [
      { userId: "user-1", login: "Daniel88dev" },
      { userId: "user-2", login: "mira" },
    ],
  };

  it("filters the list by assignee in the URL, and shows each row's", () => {
    render(
      <TaskList
        list={{
          total: 2,
          tasks: [
            { ...item, key: "T-2", assignee: { id: you.id, login: null } },
            {
              ...item,
              key: "HAL-7",
              assignee: { id: "user-2", login: "mira" },
            },
          ],
        }}
        filter={{
          view: "open",
          repository: "",
          text: "",
          labels: [],
          assignees: ["~me"],
        }}
        you={you}
        people={[{ login: "mira", groups: "HAL" }]}
      />,
    );

    expect(screen.getByRole("link", { name: /T-2/ })).toHaveTextContent("You");
    expect(screen.getByRole("link", { name: /HAL-7/ })).toHaveTextContent(
      "mira",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Assignee filter: Assigned to me" }),
    );
    expect(
      screen.getByRole("checkbox", { name: /Assigned to me/ }),
    ).toHaveAttribute("href", "/tasks");
    expect(screen.getByRole("checkbox", { name: /mira/ })).toHaveAttribute(
      "href",
      "/tasks?assignee=%7Eme%2Cmira",
    );
  });

  it("assigns a group task as soon as a member is picked", async () => {
    const assign = vi.fn(async () => ({ error: null, saved: 1 }));
    render(
      <TaskDetail
        task={{ ...brief, key: "HAL-2" }}
        actions={actions({ assign })}
        you="Daniel88dev"
        space={hal}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Unassigned. Assign someone" }),
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /mira/ }));
    });
    let sent = assign.mock.calls.at(-1) as unknown as [unknown, FormData];
    expect(sent[1].get("assignee")).toBe("mira");
    expect(sent[1].get("task")).toBe("HAL-2");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Assign to me" }));
    });
    sent = assign.mock.calls.at(-1) as unknown as [unknown, FormData];
    expect(sent[1].get("assignee")).toBe("Daniel88dev");
  });

  it("keeps a personal task with its owner", () => {
    render(
      <TaskDetail
        task={brief}
        actions={actions()}
        you="Daniel88dev"
        space={{ kind: "personal", name: "Personal", members: [] }}
      />,
    );

    expect(
      screen.getByText("Personal tasks are always yours."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Assign someone/ }),
    ).not.toBeInTheDocument();
  });

  it("starts a group task unassigned in New task, locking a personal one", async () => {
    const create = vi.fn(async () => ({ error: null, saved: 1 }));
    render(
      <NewTaskForm
        action={create}
        defaults={{ repository: "", parent: "", source: "", title: "" }}
        you="Daniel88dev"
        spaces={[
          {
            prefix: "T",
            name: "Personal",
            kind: "personal",
            who: "Only you",
            next: "T-9",
            labels: [],
            members: [],
          },
          {
            prefix: "HAL",
            who: "2 members",
            next: "HAL-3",
            labels: [],
            ...hal,
          },
        ]}
      />,
    );

    expect(
      screen.getByText("Personal tasks are always yours."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Space:/ }));
    fireEvent.click(screen.getByRole("button", { name: /Halcyon Labs/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Unassigned. Assign someone" }),
    );
    fireEvent.click(screen.getByRole("button", { name: /mira/ }));
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Board" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Create task" }));
    });
    const sent = create.mock.calls[0] as unknown as [unknown, FormData];
    expect(sent[1].get("space")).toBe("HAL");
    expect(sent[1].get("assignee")).toBe("mira");
  });
});

describe("TaskDialogContent", () => {
  it("opens the full page with a plain link, so the dialog is not reopened", () => {
    render(<TaskDialogContent task={brief} actions={actions()} />);

    const full = screen.getByRole("link", { name: "Full page" });
    expect(full).toHaveAttribute("href", "/tasks/T-2");
    expect(
      screen.getByRole("heading", { name: /Fix the lint job/ }),
    ).toHaveAttribute("id", "task-dialog-title");
    expect(screen.getByRole("button", { name: "Mark done" })).toBeVisible();
  });
});

describe("task trail", () => {
  it("links the parent above the title, and copies the task's link", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(<TaskDialogContent task={brief} actions={actions()} />);

    const trail = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(trail).getByRole("link", { name: /T-1/ })).toHaveAttribute(
      "href",
      "/tasks/T-1",
    );

    await act(async () => {
      fireEvent.click(
        within(trail).getByRole("button", { name: "Copy link to T-2" }),
      );
    });
    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/tasks/T-2`,
    );
    expect(within(trail).getByRole("status")).toHaveTextContent("Copied");
  });

  it("moves a task under another parent from Edit details", async () => {
    const update = vi.fn(async () => ({ error: null, saved: 1 }));
    render(
      <TaskDetail
        task={brief}
        actions={actions({ update })}
        parents={[
          { key: "T-1", title: "Ship it" },
          { key: "T-2", title: "Fix the lint job" },
          { key: "T-7", title: "Agent access epic" },
        ]}
      />,
    );

    const field = screen.getByRole("button", { name: /^Parent/ });
    expect(field).toHaveTextContent("T-1");
    fireEvent.click(field);
    const list = screen.getByRole("dialog", { name: "Parent task" });
    expect(within(list).queryByText("Fix the lint job")).toBeNull();
    const find = screen.getByLabelText("Find a task");
    fireEvent.change(find, { target: { value: "epic" } });
    fireEvent.keyDown(find, { key: "Enter" });
    expect(field).toHaveTextContent("T-7");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });
    const sent = update.mock.calls[0] as unknown as [unknown, FormData];
    expect(sent[1].get("parent")).toBe("T-7");
  });
});

describe("NewTaskForm", () => {
  const defaults = { repository: "o/r", parent: "", source: "", title: "" };

  it("files the task in the space picked, offering that space's parents", async () => {
    const create = vi.fn(async () => ({ error: null, saved: 1 }));
    render(
      <NewTaskForm
        action={create}
        defaults={{ ...defaults, parent: "HAL-2" }}
        parents={[
          { key: "T-1", title: "Mine" },
          { key: "HAL-2", title: "Shared" },
        ]}
        spaces={[
          {
            prefix: "T",
            name: "Personal",
            kind: "personal",
            who: "Only you",
            next: "T-9",
            labels: [],
            members: [],
          },
          {
            prefix: "HAL",
            name: "Halcyon Labs",
            kind: "group",
            who: "3 members",
            next: "HAL-3",
            labels: [{ name: "design", colour: "pink" }],
            members: [],
          },
        ]}
      />,
    );

    expect(screen.getByText("HAL-3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Parent/ })).toHaveTextContent(
      "HAL-2",
    );

    fireEvent.click(screen.getByRole("button", { name: /^Space:/ }));
    fireEvent.click(screen.getByRole("button", { name: /Personal/ }));
    expect(screen.getByText("T-9")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Parent/ })).toHaveTextContent(
      "No parent",
    );

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Retry webhooks" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Create task" }));
    });
    const sent = create.mock.calls[0] as unknown as [unknown, FormData];
    expect(sent[1].get("space")).toBe("T");
    expect(sent[1].get("parent")).toBe("");
  });

  it("tells the server it was sent from the dialog, so history is replaced", async () => {
    const create = vi.fn(async () => ({ error: null, saved: 1 }));
    render(
      <NewTaskForm action={create} defaults={defaults} variant="dialog" />,
    );

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Retry webhooks" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Create task" }));
    });

    const sent = create.mock.calls[0] as unknown as [unknown, FormData];
    expect(sent[1].get("from")).toBe("dialog");
    expect(sent[1].get("repository")).toBe("o/r");
    expect(sent[1].get("priority")).toBe("none");
  });

  it("sends the labels picked, without submitting on Enter in the filter", async () => {
    const create = vi.fn(async () => ({ error: null, saved: 1 }));
    render(
      <NewTaskForm
        action={create}
        defaults={defaults}
        labels={[{ name: "docs", colour: "blue" }]}
      />,
    );

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Retry webhooks" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add labels" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "docs" }));
    const find = screen.getByLabelText("Find or create a label");
    fireEvent.change(find, { target: { value: "backend" } });
    fireEvent.keyDown(find, { key: "Enter" });
    expect(create).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Create task" }));
    });
    const sent = create.mock.calls[0] as unknown as [unknown, FormData];
    expect(sent[1].getAll("labels")).toEqual(["docs", "backend"]);
  });

  it("picks the repository from the watched ones, or none", async () => {
    const create = vi.fn(async () => ({ error: null, saved: 1 }));
    render(
      <NewTaskForm
        action={create}
        defaults={{ ...defaults, repository: "" }}
        repositories={[
          { name: "Daniel88dev/fenro-dashboard", pinned: true },
          { name: "nordwind/docs", pinned: false },
        ]}
      />,
    );

    expect(screen.queryByRole("textbox", { name: "Repository" })).toBeNull();
    const field = screen.getByRole("button", { name: "Repository" });
    expect(field).toHaveTextContent("No repository");

    fireEvent.click(field);
    const find = screen.getByLabelText("Find a repository");
    fireEvent.change(find, { target: { value: "docs" } });
    fireEvent.keyDown(find, { key: "Enter" });
    expect(field).toHaveTextContent("nordwind/docs");

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Retry webhooks" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Create task" }));
    });
    const sent = create.mock.calls[0] as unknown as [unknown, FormData];
    expect(sent[1].get("repository")).toBe("nordwind/docs");

    fireEvent.click(field);
    fireEvent.click(screen.getByRole("button", { name: "No repository" }));
    expect(field).toHaveTextContent("No repository");
    expect(
      document.querySelector<HTMLInputElement>('input[name="repository"]')
        ?.value,
    ).toBe("");
  });

  it("keeps a repository from the URL that is not watched on offer", () => {
    render(
      <NewTaskForm
        action={actions().create}
        defaults={defaults}
        repositories={[{ name: "nordwind/docs", pinned: false }]}
      />,
    );

    const field = screen.getByRole("button", { name: "Repository" });
    expect(field).toHaveTextContent("o/r");
    fireEvent.click(field);
    expect(screen.getByRole("button", { name: "o/r" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("floats the label and repository lists above the dialog instead of inside it", () => {
    render(
      <NewTaskForm
        action={actions().create}
        defaults={defaults}
        labels={[{ name: "docs", colour: "blue" }]}
        variant="dialog"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add labels" }));
    const labels = screen.getByRole("dialog", { name: "Labels" });
    expect(labels).toHaveClass("fixed");

    fireEvent.click(screen.getByRole("button", { name: "Repository" }));
    const repositories = screen.getByRole("dialog", { name: "Repository" });
    expect(repositories).toHaveClass("fixed");
  });

  it("leaves the dialog marker off on the page", () => {
    const { container } = render(
      <NewTaskForm action={actions().create} defaults={defaults} />,
    );

    expect(container.querySelector('input[name="from"]')).toBeNull();
  });
});

describe("TasksPanel", () => {
  it("opens each task and starts a new one on the repository", () => {
    render(
      <TasksPanel
        id="tasks"
        repository="Daniel88dev/fenro-dashboard"
        data={{
          summary: "1 running",
          total: 7,
          shown: [
            {
              id: "T-2",
              title: "Fix the lint job",
              lastActivity: "Session 1 running, 6 min in",
              state: "running",
              contextItems: 3,
            },
          ],
        }}
      />,
    );

    expect(
      screen.getByRole("link", { name: /Fix the lint job/ }),
    ).toHaveAttribute("href", "/tasks/T-2");
    expect(screen.getByRole("link", { name: "New task here" })).toHaveAttribute(
      "href",
      "/tasks/new?repository=Daniel88dev%2Ffenro-dashboard",
    );
    expect(
      screen.getByRole("link", { name: "Show the other 6" }),
    ).toHaveAttribute(
      "href",
      "/tasks?repository=Daniel88dev%2Ffenro-dashboard",
    );
  });
});
