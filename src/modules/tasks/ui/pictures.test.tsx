import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import type {
  PictureItem,
  TaskBrief,
} from "@/modules/tasks/application/queries/read-models";

import { PicturesSection, PictureStrip } from "./pictures";
import { groupPictures, JournalSection } from "./task-detail";
import type { TaskActions } from "./task-forms";

// jsdom has no modal dialogs; the viewer only needs open to follow the calls.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});

function picture(
  id: string,
  addedAt: string,
  fields: Partial<PictureItem> = {},
): PictureItem {
  return {
    id,
    name: `${id}.png`,
    type: "image/png",
    bytes: 120_000,
    addedBy: "claude-code",
    addedByKind: "agent",
    session: 3,
    addedAt,
    ...fields,
  };
}

const PICTURES = [
  picture("a", "2026-09-26T15:40:00.000Z"),
  picture("b", "2026-09-26T15:42:00.000Z"),
  picture("c", "2026-09-26T16:30:00.000Z", {
    addedBy: "Daniel",
    addedByKind: "human",
    session: null,
  }),
];

const saved = vi.fn(async () => ({ error: null, saved: 1 }));

describe("the Pictures section", () => {
  it("opens a picture large and steps through the rest with the arrow keys", () => {
    render(
      <PicturesSection
        taskKey="T-2"
        pictures={PICTURES}
        removeAction={saved}
        enabled
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open b.png" }));
    const viewer = screen.getByRole("dialog", { name: "b.png" });
    expect(within(viewer).getByRole("img", { name: "b.png" })).toHaveAttribute(
      "src",
      "/api/pictures/b",
    );
    expect(viewer).toHaveTextContent("2 of 3");
    expect(viewer).toHaveTextContent("Added by claude-code, session 3");

    fireEvent.keyDown(viewer, { key: "ArrowRight" });
    expect(screen.getByRole("dialog", { name: "c.png" })).toHaveTextContent(
      "3 of 3",
    );
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowRight" });
    expect(screen.getByRole("dialog", { name: "a.png" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("asks before removing, then sends the task and the picture", async () => {
    const remove = vi.fn(async () => ({ error: null, saved: 1 }));
    render(
      <PicturesSection
        taskKey="T-2"
        pictures={PICTURES}
        removeAction={remove}
        enabled
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open a.png" }));
    const viewer = screen.getByRole("dialog");

    fireEvent.click(within(viewer).getByRole("button", { name: "Remove" }));
    expect(viewer).toHaveTextContent("Remove this picture?");
    await act(async () => {
      fireEvent.click(within(viewer).getByRole("button", { name: "Remove" }));
    });

    expect(remove).toHaveBeenCalledOnce();
    const form = (remove.mock.calls[0] as unknown[])[1] as FormData;
    expect(Object.fromEntries(form)).toEqual({ task: "T-2", picture: "a" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("says how to turn pictures on when no store is set up", () => {
    render(
      <PicturesSection
        taskKey="T-2"
        pictures={[]}
        removeAction={saved}
        enabled={false}
      />,
    );

    expect(screen.getByText(/UPLOADTHING_TOKEN/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Add pictures/ }),
    ).not.toBeInTheDocument();
  });
});

describe("the dialog's picture strip", () => {
  it("shows the newest three and sends the rest to the full page", () => {
    render(
      <PictureStrip
        taskKey="T-2"
        pictures={[...PICTURES, picture("d", "2026-09-26T17:00:00.000Z")]}
        removeAction={saved}
        enabled
        fullPage="/tasks/T-2"
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Open a.png" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open d.png" })).toBeVisible();
    expect(
      screen.getByRole("link", { name: "All 4 on the full page" }),
    ).toHaveAttribute("href", "/tasks/T-2");
  });
});

describe("pictures in the journal", () => {
  it("groups what one adder put on in one go", () => {
    expect(
      groupPictures(PICTURES).map((group) => group.pictures.length),
    ).toEqual([2, 1]);
  });

  it("puts each batch among the entries at the time it was added", () => {
    const task = {
      key: "T-2",
      latestHandoff: null,
      recentJournal: [
        {
          kind: "note",
          text: "Started on the layout.",
          author: "claude-code",
          session: 3,
          recordedAt: "2026-09-26T15:00:00.000Z",
        },
        {
          kind: "decision",
          text: "Going with direction A.",
          author: "Daniel",
          session: null,
          recordedAt: "2026-09-26T16:00:00.000Z",
        },
      ],
      journalEntries: 2,
      pictures: PICTURES,
    } as unknown as TaskBrief;
    const actions = {
      note: saved,
      removePicture: saved,
    } as unknown as TaskActions;

    render(<JournalSection task={task} actions={actions} />);

    const lines = within(screen.getByRole("list"))
      .getAllByRole("listitem")
      .map((line) => line.textContent);
    expect(lines[0]).toContain("Started on the layout.");
    expect(lines[1]).toContain("Added a.png and b.png.");
    expect(lines[2]).toContain("Going with direction A.");
    expect(lines[3]).toContain("Added c.png.");
  });
});
