import { act, fireEvent, render, screen, within } from "@testing-library/react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

import type {
  TaskSearch,
  TaskSearchHit,
} from "@/modules/tasks/application/queries/read-models";

import { SearchPalette } from "./search-palette";

// jsdom has no modal dialogs, ResizeObserver or scrollIntoView; cmdk and the
// palette only need them to exist.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView = () => {};
});

const hit = (key: string, title: string, fields: Partial<TaskSearchHit> = {}) =>
  ({
    key,
    kind: "task",
    title,
    state: "ready",
    repository: null,
    progress: null,
    excerpt: null,
    ...fields,
  }) satisfies TaskSearchHit;

const none: TaskSearch = {
  recent: [],
  byNumber: [],
  tasks: [],
  epics: [],
  inDescriptions: [],
  moreInDescriptions: 0,
};

let answer: (url: URL) => TaskSearch;
const asked: URL[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  asked.length = 0;
  push.mockReset();
  answer = () => none;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const url = new URL(input, "https://fenro.test");
      asked.push(url);
      return Response.json(answer(url));
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const PAGES = [
  { label: "Repositories", href: "/repositories", icon: null },
  { label: "Task board", href: "/tasks?layout=board", icon: null },
];

async function settle() {
  await act(async () => {
    await vi.runAllTimersAsync();
  });
}

async function openWithShortcut() {
  render(<SearchPalette pages={PAGES} />);
  fireEvent.keyDown(document, { key: "k", metaKey: true });
  await settle();
  return screen.getByRole("dialog", { name: "Search tasks and pages" });
}

async function type(text: string) {
  fireEvent.change(screen.getByPlaceholderText("Task number, name or page"), {
    target: { value: text },
  });
  await settle();
}

describe("the search palette", () => {
  it("opens on Cmd+K with recent tasks and every page", async () => {
    answer = () => ({ ...none, recent: [hit("T-47", "Command palette")] });

    const dialog = await openWithShortcut();

    expect(dialog).toHaveAttribute("open");
    expect(asked[0]!.searchParams.get("q")).toBe("");
    expect(within(dialog).getByText("Recent")).toBeInTheDocument();
    expect(within(dialog).getByText("Command palette")).toBeInTheDocument();
    expect(within(dialog).getByText("Repositories")).toBeInTheDocument();
    expect(within(dialog).getByText("Task board")).toBeInTheDocument();
  });

  it("searches as you type, narrows the pages and marks the words that matched", async () => {
    answer = (url) =>
      url.searchParams.get("q") === "board"
        ? { ...none, tasks: [hit("T-55", "Board on touch screens")] }
        : none;
    const dialog = await openWithShortcut();

    await type("board");

    expect(asked.at(-1)!.searchParams.get("q")).toBe("board");
    expect(within(dialog).getByText("Tasks")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Board", { selector: "mark" }),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText("Repositories")).not.toBeInTheDocument();
    expect(
      within(dialog).getByText("board", { selector: "mark" }),
    ).toBeInTheDocument();
  });

  it("searches descriptions only once they are switched on, from the hint or Ctrl+/", async () => {
    answer = (url) =>
      url.searchParams.get("descriptions") === "1"
        ? {
            ...none,
            inDescriptions: [
              hit("T-64", "Pause the agent", { excerpt: "stops mid sync" }),
            ],
          }
        : { ...none, moreInDescriptions: 1 };
    const dialog = await openWithShortcut();
    await type("sync");

    expect(asked.at(-1)!.searchParams.has("descriptions")).toBe(false);
    fireEvent.click(within(dialog).getByText("1 more match in descriptions"));
    await settle();

    expect(asked.at(-1)!.searchParams.get("descriptions")).toBe("1");
    expect(within(dialog).getByText("In descriptions")).toBeInTheDocument();
    expect(
      within(dialog).getByText("sync", { selector: "mark" }),
    ).toBeInTheDocument();

    fireEvent.keyDown(
      screen.getByPlaceholderText("Task number, name or page"),
      {
        key: "/",
        ctrlKey: true,
      },
    );
    await settle();
    expect(asked.at(-1)!.searchParams.has("descriptions")).toBe(false);
  });

  it("opens the chosen task and closes", async () => {
    answer = () => ({
      ...none,
      byNumber: [hit("T-4", "Sign in"), hit("T-44", "Retry the sync")],
    });
    const dialog = await openWithShortcut();
    await type("4");

    expect(
      within(dialog)
        .getAllByText("4", { selector: "mark" })
        .map((mark) => mark.parentElement!.textContent),
    ).toEqual(["T-4", "T-44"]);

    fireEvent.click(within(dialog).getByText("Retry the sync"));

    expect(push).toHaveBeenCalledWith("/tasks/T-44");
    expect(dialog).not.toHaveAttribute("open");
  });

  it("says when nothing matches", async () => {
    const dialog = await openWithShortcut();
    await type("zzz");

    expect(
      within(dialog).getByText("No tasks or pages match “zzz”."),
    ).toBeInTheDocument();
  });
});
