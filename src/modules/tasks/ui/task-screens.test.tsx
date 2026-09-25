import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
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
  title: "Fix the lint job",
  status: "todo",
  state: "blocked",
  priority: "high",
  labels: [],
  repository: "Daniel88dev/fenro-dashboard",
  parent: "T-1",
  blockedBy: ["T-4"],
  hold: null,
  workedOnBy: null,
  subtasks: { open: 0, total: 0 },
  criteria: { met: 1, total: 2 },
  journalEntries: 3,
  updatedAt: "2026-09-24T10:00:00.000Z",
};

const brief: TaskBrief = {
  key: "T-2",
  id: "00000000-0000-4000-8000-000000000002",
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
  parent: { key: "T-1", title: "Ship it", status: "todo", state: "waiting" },
  subtasks: [],
  blockedBy: [{ key: "T-4", title: "Upgrade", status: "done", state: "done" }],
  blocks: [{ key: "T-5", title: "Release", status: "todo", state: "blocked" }],
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
  createdAt: "2026-09-24T07:00:00.000Z",
  updatedAt: "2026-09-24T09:00:00.000Z",
};

function actions(overrides: Partial<TaskActions> = {}): TaskActions {
  const saved = vi.fn(async () => ({ error: null, saved: 1 }));
  return {
    create: saved,
    update: saved,
    labels: saved,
    edit: saved,
    note: saved,
    checkCriterion: saved,
    changeStatus: saved,
    link: saved,
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

    const filters = screen.getByRole("navigation", { name: "Filter by label" });
    const bug = within(filters).getByRole("link", { name: "bug" });
    const docs = within(filters).getByRole("link", { name: "docs" });
    expect(bug).toHaveAttribute("aria-pressed", "true");
    expect(bug).toHaveAttribute("href", "/tasks?view=blocked");
    expect(docs).toHaveAttribute(
      "href",
      "/tasks?view=blocked&labels=bug%2Cdocs",
    );
    expect(
      screen.getByRole("link", { name: /Fix the lint job/ }),
    ).toHaveTextContent("bug");
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
    // "T-5 is blocked by this" is stored on T-5, so it is removed there.
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

describe("NewTaskForm", () => {
  const defaults = { repository: "o/r", parent: "", source: "", title: "" };

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
