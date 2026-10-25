import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import type {
  PictureItem,
  QuestionnaireItem,
} from "@/modules/tasks/application/queries/read-models";

import {
  QuestionnaireProvider,
  QuestionRounds,
  QuestionsForYou,
} from "./questionnaires";
import type { TaskAction } from "./task-forms";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});

const layoutPicture: PictureItem = {
  id: "pic-a",
  name: "layout-a.png",
  type: "image/png",
  bytes: 1000,
  addedBy: "claude-code",
  addedByKind: "agent",
  session: 3,
  addedAt: "2026-10-25T09:00:00.000Z",
};

function round(fields: Partial<QuestionnaireItem> = {}): QuestionnaireItem {
  return {
    id: "round-2",
    round: 2,
    title: "Import scope",
    intro: null,
    status: "open",
    questions: [
      {
        id: "scope",
        type: "single",
        prompt: "Which issues come in?",
        details: null,
        pictures: [],
        suggestions: [
          {
            id: "a",
            label: "Assigned to me",
            description: null,
            recommended: true,
            picture: layoutPicture,
          },
          {
            id: "b",
            label: "The whole project",
            description: "About 310 issues",
            recommended: false,
            picture: null,
          },
        ],
      },
      {
        id: "notes",
        type: "text",
        prompt: "Anything about your Jira setup?",
        details: null,
        pictures: [],
        suggestions: [],
      },
    ],
    answers: null,
    answered: 0,
    postedBy: "claude-code",
    postedByKind: "agent",
    session: 3,
    postedAt: "2026-10-25T09:50:00.000Z",
    answeredBy: null,
    answeredAt: null,
    withdrawnAt: null,
    withdrawnReason: null,
    ...fields,
  };
}

const answered = round({
  id: "round-1",
  round: 1,
  title: "How tasks look",
  status: "answered",
  answers: [
    {
      questionId: "scope",
      choices: ["b"],
      text: "Only **FEN**.",
      pictures: [],
      skipped: false,
    },
    {
      questionId: "notes",
      choices: [],
      text: null,
      pictures: [],
      skipped: true,
    },
  ],
  answered: 1,
  answeredBy: "Daniel",
  answeredAt: "2026-10-24T10:00:00.000Z",
});

function show(
  rounds: readonly QuestionnaireItem[],
  answer: TaskAction = vi.fn(async (state) => ({ ...state, saved: 1 })),
  remove: TaskAction = vi.fn(async (state) => state),
) {
  render(
    <QuestionnaireProvider
      taskKey="T-1"
      rounds={rounds}
      answerAction={answer}
      removePictureAction={remove}
      picturesEnabled
      now="2026-10-25T10:00:00.000Z"
    >
      <QuestionsForYou />
      <QuestionRounds />
    </QuestionnaireProvider>,
  );
  return { answer, remove };
}

const drawer = () => screen.getByRole("dialog", { name: /Round 2/ });

describe("rounds of questions on a task", () => {
  it("lists every round, newest first, with its state", () => {
    show([answered, round()]);
    const cards = within(
      screen.getByRole("region", { name: "Questions from the agent" }),
    ).getAllByRole("button");
    expect(cards.map((card) => card.getAttribute("aria-label"))).toEqual([
      "Round 2, Import scope, 2 questions, waiting on you",
      "Round 1, How tasks look, 2 questions, answered 24 oct",
    ]);
    expect(screen.getByText("2 rounds")).toBeTruthy();
  });

  it("opens the open round from the chip by the title", () => {
    show([round()]);
    fireEvent.click(
      screen.getByRole("button", { name: "2 questions for you" }),
    );
    expect(within(drawer()).getByText("Which issues come in?")).toBeTruthy();
    expect(within(drawer()).getByText("Recommended")).toBeTruthy();
  });

  it("submits the picked suggestion and the free text", async () => {
    const { answer } = show([round()]);
    fireEvent.click(screen.getByRole("button", { name: /Round 2/ }));
    fireEvent.click(
      within(drawer()).getByRole("button", { name: /The whole project/ }),
    );
    fireEvent.change(within(drawer()).getAllByLabelText("Your answer")[1]!, {
      target: { value: "  Two sites.  " },
    });
    fireEvent.click(
      within(drawer()).getByRole("button", { name: "Submit answers" }),
    );

    await waitFor(() => expect(answer).toHaveBeenCalledTimes(1));
    const form = vi.mocked(answer).mock.calls[0]![1];
    expect(form.get("task")).toBe("T-1");
    expect(form.get("round")).toBe("2");
    expect(JSON.parse(String(form.get("answers")))).toEqual([
      { questionId: "scope", choices: ["b"], text: null, pictures: [] },
      { questionId: "notes", choices: [], text: "Two sites.", pictures: [] },
    ]);
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: /Round 2/ })).toBeNull(),
    );
  });

  it("names the unanswered questions before submitting with gaps", async () => {
    const { answer } = show([round()]);
    fireEvent.click(screen.getByRole("button", { name: /Round 2/ }));
    fireEvent.click(
      within(drawer()).getByRole("button", { name: /Assigned to me/ }),
    );
    fireEvent.click(
      within(drawer()).getByRole("button", { name: "Submit answers" }),
    );

    const confirm = screen.getByRole("alertdialog", {
      name: "1 question has no answer. Submit anyway?",
    });
    expect(
      within(confirm).getByText("Anything about your Jira setup?"),
    ).toBeTruthy();
    expect(answer).not.toHaveBeenCalled();

    fireEvent.click(
      within(confirm).getByRole("button", { name: "Submit anyway" }),
    );
    await waitFor(() => expect(answer).toHaveBeenCalledTimes(1));
  });

  it("warns before closing with answers, and keeps them on Keep answering", () => {
    show([round()]);
    fireEvent.click(screen.getByRole("button", { name: /Round 2/ }));
    fireEvent.click(
      within(drawer()).getByRole("button", { name: /Assigned to me/ }),
    );
    fireEvent.click(
      within(drawer()).getByRole("button", { name: "Close questions" }),
    );

    const confirm = screen.getByRole("alertdialog", {
      name: "Discard your answers?",
    });
    fireEvent.click(
      within(confirm).getByRole("button", { name: "Keep answering" }),
    );
    expect(
      within(drawer())
        .getByRole("button", { name: /Assigned to me/ })
        .getAttribute("aria-pressed"),
    ).toBe("true");

    fireEvent.keyDown(drawer(), { key: "Escape" });
    fireEvent.click(
      within(
        screen.getByRole("alertdialog", { name: "Discard your answers?" }),
      ).getByRole("button", { name: "Discard answers" }),
    );
    expect(screen.queryByRole("dialog", { name: /Round 2/ })).toBeNull();
  });

  it("closes an untouched round without asking", () => {
    show([round()]);
    fireEvent.click(screen.getByRole("button", { name: /Round 2/ }));
    fireEvent.click(
      within(drawer()).getByRole("button", { name: "Close questions" }),
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.queryByRole("dialog", { name: /Round 2/ })).toBeNull();
  });

  it("chooses a suggestion from the picture viewer", () => {
    show([round()]);
    fireEvent.click(screen.getByRole("button", { name: /Round 2/ }));
    fireEvent.click(
      within(drawer()).getByRole("button", { name: "Open layout-a.png large" }),
    );
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Choose A" }));
    });
    expect(
      within(drawer())
        .getByRole("button", { name: /Assigned to me/ })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("shows an answered round read-only, with skipped questions said so", () => {
    show([answered]);
    fireEvent.click(screen.getByRole("button", { name: /Round 1/ }));
    const view = screen.getByRole("dialog", { name: /Round 1/ });
    expect(within(view).getByText("The whole project")).toBeTruthy();
    expect(within(view).getByText("FEN").tagName).toBe("STRONG");
    expect(within(view).getByText("Skipped")).toBeTruthy();
    expect(within(view).queryByRole("button", { name: /Submit/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /questions for you/ })).toBe(
      null,
    );
  });
});
