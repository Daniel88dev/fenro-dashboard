import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({
  refresh: vi.fn(),
  back: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => window.location.pathname,
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

import type { TaskBrief } from "@/modules/tasks/application/queries/read-models";

import type { TaskActions } from "./task-forms";
import {
  HOVER_INTENT_MS,
  TaskDialogs,
  type TaskDialogView,
} from "./task-dialogs";
import { TaskLink } from "./task-link";

const brief = {
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
    { number: 1, text: "CI is green", met: false, evidence: null },
  ],
  hold: null,
  parent: null,
  epic: null,
  progress: null,
  subtasks: [],
  blockedBy: [],
  blocks: [],
  relatesTo: [],
  discoveredFrom: null,
  discovered: [],
  references: [],
  session: null,
  sessions: 0,
  latestHandoff: null,
  decisions: [],
  recentJournal: [],
  journalEntries: 0,
  pictures: [],
  questionnaires: [],
  skills: [],
  createdAt: "2026-09-24T07:00:00.000Z",
  updatedAt: "2026-09-24T09:00:00.000Z",
} satisfies TaskBrief;

const view: TaskDialogView = {
  task: brief,
  labels: [],
  you: { id: "u1", login: "octocat" },
  picturesEnabled: false,
};

const saved = vi.fn(async () => ({ error: null, saved: 1 }));
const actions = {
  create: saved,
  update: saved,
  labels: saved,
  assign: saved,
  kind: saved,
  edit: saved,
  note: saved,
  checkCriterion: saved,
  changeStatus: saved,
  link: saved,
  removePicture: saved,
  answer: saved,
} satisfies TaskActions;

let respond: (body: TaskDialogView) => void = () => {};
const fetchTask = vi.fn(
  () =>
    new Promise<Response>((resolve) => {
      respond = (body) => resolve(Response.json(body));
    }),
);

beforeEach(() => {
  window.history.replaceState(null, "", "/tasks?view=open");
  vi.stubGlobal("fetch", fetchTask);
  vi.spyOn(window.history, "back").mockImplementation(() => {
    window.history.replaceState(null, "", "/tasks?view=open");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  fetchTask.mockClear();
  saved.mockClear();
});

function renderList() {
  render(
    <TaskDialogs actions={actions}>
      <TaskLink
        href="/tasks/T-2"
        preview={{ title: "Fix the lint job", kind: "task" }}
      >
        T-2
      </TaskLink>
    </TaskDialogs>,
  );
  return screen.getByRole("link", { name: "T-2" });
}

function renderRows(keys: readonly string[]) {
  render(
    <TaskDialogs actions={actions}>
      {keys.map((key) => (
        <TaskLink key={key} href={`/tasks/${key}`}>
          {key}
        </TaskLink>
      ))}
    </TaskDialogs>,
  );
}

describe("TaskDialogs", () => {
  it("opens the dialog on click, before the task arrives, without the router", () => {
    const link = renderList();

    fireEvent.click(link);

    expect(
      window.location.pathname + window.location.search + window.location.hash,
    ).toBe("/tasks?view=open#open=T-2");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(
      "T-2Fix the lint job",
    );
    expect(screen.getByRole("status")).toHaveTextContent("Loading the task");
    expect(router.push).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("reads the task on hover, so the click shows it at once", async () => {
    vi.useFakeTimers();
    const link = renderList();

    fireEvent.pointerEnter(link);
    act(() => vi.advanceTimersByTime(HOVER_INTENT_MS));
    expect(fetchTask).toHaveBeenCalledWith("/api/tasks/T-2");
    await act(async () => respond(view));
    vi.useRealTimers();

    fireEvent.click(link);

    expect(fetchTask).toHaveBeenCalledOnce();
    expect(screen.getByText("CI is green")).toBeInTheDocument();
  });

  it("does not read tasks the pointer only passes over", () => {
    vi.useFakeTimers();
    renderRows(["T-2", "T-3", "T-4"]);

    for (const key of ["T-2", "T-3", "T-4"]) {
      const row = screen.getByRole("link", { name: key });
      fireEvent.pointerEnter(row);
      act(() => vi.advanceTimersByTime(HOVER_INTENT_MS / 3));
      fireEvent.pointerLeave(row);
    }
    act(() => vi.advanceTimersByTime(HOVER_INTENT_MS * 2));

    expect(fetchTask).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("reads one hovered task at a time, then only the latest one", async () => {
    vi.useFakeTimers();
    renderRows(["T-2", "T-3", "T-4"]);
    const rest = (key: string) => {
      fireEvent.pointerEnter(screen.getByRole("link", { name: key }));
      act(() => vi.advanceTimersByTime(HOVER_INTENT_MS));
    };

    rest("T-2");
    rest("T-3");
    rest("T-4");
    expect(fetchTask.mock.calls).toEqual([["/api/tasks/T-2"]]);

    await act(async () => respond(view));
    expect(fetchTask.mock.calls).toEqual([
      ["/api/tasks/T-2"],
      ["/api/tasks/T-4"],
    ]);
    vi.useRealTimers();
  });

  it("goes back to the page when the dialog closes", async () => {
    const link = renderList();
    fireEvent.click(link);
    await act(async () => respond(view));

    fireEvent.click(screen.getAllByRole("button", { name: "Close" })[0]!);

    expect(window.history.back).toHaveBeenCalledOnce();
    expect(window.location.hash).toBe("");
    expect(screen.queryByText("CI is green")).not.toBeInTheDocument();
  });

  it("reads the task again after a change made in the dialog", async () => {
    window.history.replaceState(null, "", "/tasks#open=T-2");
    renderList();
    await act(async () => respond(view));
    expect(fetchTask).toHaveBeenCalledOnce();

    const form = screen.getByText("CI is green").closest("form");
    await act(async () => {
      fireEvent.submit(form!);
    });

    expect(saved).toHaveBeenCalled();
    expect(fetchTask).toHaveBeenCalledTimes(2);
  });

  it("leaves a modified click to the browser", () => {
    const link = renderList();

    fireEvent.click(link, { metaKey: true });

    expect(window.location.hash).toBe("");
    expect(fetchTask).not.toHaveBeenCalled();
  });
});
