import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type {
  BoardColumn,
  TaskListItem,
} from "@/modules/tasks/application/queries/read-models";

import { EpicRail } from "./epic-rail";
import { TaskBoard } from "./task-board";

const card: TaskListItem = {
  key: "T-2",
  kind: "task",
  title: "Fix the lint job",
  status: "todo",
  state: "ready",
  priority: "none",
  labels: [],
  repository: null,
  parent: "T-1",
  epic: { key: "T-1", title: "Ship tasks v2" },
  progress: null,
  blockedBy: [],
  hold: null,
  workedOnBy: null,
  subtasks: { open: 0, total: 0 },
  criteria: { met: 0, total: 0 },
  journalEntries: 0,
  questions: 0,
  updatedAt: "2026-10-16T10:00:00.000Z",
};

const epic: TaskListItem = {
  ...card,
  key: "T-1",
  kind: "epic",
  title: "Ship tasks v2",
  parent: null,
  epic: null,
  progress: { done: 3, total: 8 },
};

const columns: BoardColumn[] = [
  { status: "backlog", total: 0, tasks: [], finishedEarlier: 0 },
  { status: "todo", total: 1, tasks: [card], finishedEarlier: 0 },
  { status: "in_progress", total: 0, tasks: [], finishedEarlier: 0 },
  { status: "in_review", total: 0, tasks: [], finishedEarlier: 0 },
  { status: "done", total: 0, tasks: [], finishedEarlier: 0 },
];

function column(name: string) {
  return screen.getByRole("region", { name });
}

describe("TaskBoard", () => {
  it("shows a column per status with its cards", () => {
    render(<TaskBoard columns={columns} labels={[]} move={vi.fn()} />);

    for (const name of [
      "Backlog",
      "To do",
      "In progress",
      "In review",
      "Done",
    ]) {
      expect(column(name)).toBeInTheDocument();
    }
    expect(
      within(column("To do")).getByRole("link", { name: /Fix the lint job/ }),
    ).toBeInTheDocument();
    expect(within(column("To do")).getByText("Ship tasks v2")).toBeVisible();
  });

  it("moves a card with its menu", async () => {
    const move = vi.fn().mockResolvedValue({ error: null });
    render(<TaskBoard columns={columns} labels={[]} move={move} />);

    fireEvent.click(screen.getByRole("button", { name: "Move T-2" }));
    await act(async () => {
      fireEvent.click(
        screen.getByRole("menuitemradio", { name: "In progress" }),
      );
    });

    expect(move).toHaveBeenCalledWith("T-2", "in_progress");
  });

  it("moves a card dropped on another column", async () => {
    const move = vi.fn().mockResolvedValue({ error: null });
    render(<TaskBoard columns={columns} labels={[]} move={move} />);

    const data = new Map<string, string>();
    const dataTransfer = {
      setData: (type: string, value: string) => data.set(type, value),
      getData: (type: string) => data.get(type) ?? "",
      effectAllowed: "",
      dropEffect: "",
    };
    fireEvent.dragStart(
      screen.getByRole("article", { name: "Task T-2: Fix the lint job" }),
      { dataTransfer },
    );
    fireEvent.dragOver(column("In review"), { dataTransfer });
    await act(async () => {
      fireEvent.drop(column("In review"), { dataTransfer });
    });

    expect(move).toHaveBeenCalledWith("T-2", "in_review");
  });

  it("puts a refused card back and says why", async () => {
    const move = vi.fn().mockResolvedValue({
      error: "T-2 has unmet acceptance criteria.",
    });
    render(<TaskBoard columns={columns} labels={[]} move={move} />);

    fireEvent.click(screen.getByRole("button", { name: "Move T-2" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("menuitemradio", { name: "Done" }));
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "T-2 has unmet acceptance criteria.",
    );
    expect(
      within(column("To do")).getByRole("link", { name: /Fix the lint job/ }),
    ).toBeInTheDocument();
    expect(
      within(column("Done")).queryByRole("link", { name: /Fix the lint job/ }),
    ).not.toBeInTheDocument();
  });
});

describe("the Done column", () => {
  const done = {
    current: "week" as const,
    hrefs: {
      week: "/tasks?layout=board",
      month: "/tasks?layout=board&done=month",
      all: "/tasks?layout=board&done=all",
    },
  };
  const withEarlier = columns.map((entry) =>
    entry.status === "done" ? { ...entry, finishedEarlier: 269 } : entry,
  );

  it("says how many finished before the window and links a wider one", () => {
    render(
      <TaskBoard
        columns={withEarlier}
        labels={[]}
        move={vi.fn()}
        done={done}
      />,
    );

    expect(
      within(column("Done")).getByText(/269 finished earlier/),
    ).toBeVisible();
    expect(
      within(column("Done")).getByRole("link", { name: "Show past month" }),
    ).toHaveAttribute("href", "/tasks?layout=board&done=month");
  });

  it("offers every window from the menu, the current one checked", () => {
    render(
      <TaskBoard columns={columns} labels={[]} move={vi.fn()} done={done} />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Done tasks shown: Past week" }),
    );

    expect(
      screen.getByRole("menuitemradio", { name: "Past week" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("menuitemradio", { name: "All done tasks" }),
    ).toHaveAttribute("href", "/tasks?layout=board&done=all");
  });
});

describe("EpicRail", () => {
  it("scopes the work and lists the open epics with their progress", () => {
    render(
      <EpicRail
        scopes={[
          { label: "All tasks", count: 9, href: "/tasks", current: false },
          {
            label: "Epics only",
            count: 1,
            href: "/tasks?epic=epics",
            current: false,
          },
        ]}
        epics={[epic]}
        epicHref={(key) => `/tasks?epic=${key}`}
        picked="T-1"
        newEpicHref="/tasks/new?type=epic"
      />,
    );

    const rail = screen.getByRole("navigation", { name: "Epics" });
    const picked = within(rail).getByRole("link", { name: /Ship tasks v2/ });
    expect(picked).toHaveAttribute("href", "/tasks?epic=T-1");
    expect(picked).toHaveAttribute("aria-current", "page");
    expect(picked).toHaveTextContent("3 of 8 done");
    expect(
      within(rail).getByRole("link", { name: /All tasks/ }),
    ).toHaveAttribute("href", "/tasks");
    expect(
      within(rail).getByRole("link", { name: "New epic" }),
    ).toHaveAttribute("href", "/tasks/new?type=epic");
  });
});
