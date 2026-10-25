import { describe, expect, it } from "vitest";

import { isErr, unwrap } from "@/shared/domain";

import type { Actor } from "./actor";
import {
  QuestionnaireAnswered,
  QuestionnairePosted,
  QuestionnaireWithdrawn,
} from "./events";
import {
  MAX_QUESTIONS,
  Questionnaire,
  type NewQuestionnaire,
  type QuestionDraft,
} from "./questionnaire";

const now = new Date("2026-10-25T10:00:00Z");
const agent: Actor = { kind: "agent", id: "token-1", name: "claude-code" };
const daniel: Actor = { kind: "human", id: "user-1", name: "Daniel" };

const layout: QuestionDraft = {
  id: "layout",
  prompt: "Which board layout should epics use?",
  details: "Both keep drag and drop.",
  pictures: ["pic-1"],
  suggestions: [
    { label: "Columns by status", recommended: true, picture: "pic-2" },
    { label: "One column per epic", description: "Grouped under each epic." },
  ],
};

function post(overrides: Partial<NewQuestionnaire> = {}) {
  return Questionnaire.post({
    id: "round-1",
    ownerId: "user-1",
    taskId: "task-1",
    number: 1,
    title: "Board layout for epics",
    questions: [layout, { prompt: "What should an empty epic show?" }],
    postedBy: agent,
    sessionId: "session-1",
    taskPictures: new Set(["pic-1", "pic-2", "pic-3"]),
    now,
    ...overrides,
  });
}

const refusal = (result: ReturnType<typeof post>) =>
  isErr(result) ? result.error : undefined;

describe("posting a round of questions", () => {
  it("fills in ids and types an agent left out, and opens the round", () => {
    const round = unwrap(post());
    expect(round.status).toBe("open");
    expect(round.state.questions.map((q) => [q.id, q.type])).toEqual([
      ["layout", "single"],
      ["q2", "text"],
    ]);
    expect(round.state.questions[0]?.suggestions).toEqual([
      {
        id: "a",
        label: "Columns by status",
        description: null,
        recommended: true,
        picture: "pic-2",
      },
      {
        id: "b",
        label: "One column per epic",
        description: "Grouped under each epic.",
        recommended: false,
        picture: null,
      },
    ]);
    expect(round.pullDomainEvents()).toEqual([expect.any(QuestionnairePosted)]);
  });

  it("drops an Other suggestion, since every question takes free text", () => {
    const round = unwrap(
      post({
        questions: [
          {
            prompt: "Pick one",
            suggestions: [
              { label: "Yes" },
              { label: "No" },
              { label: "Other (please specify)" },
            ],
          },
        ],
      }),
    );
    expect(round.state.questions[0]?.suggestions.map((s) => s.label)).toEqual([
      "Yes",
      "No",
    ]);
  });

  it.each([
    [[], "1 to 10 questions"],
    [
      Array.from({ length: MAX_QUESTIONS + 1 }, () => ({ prompt: "Why?" })),
      "1 to 10 questions",
    ],
    [[{ prompt: "Pick", suggestions: [{ label: "Only one" }] }], "give 2 to 6"],
    [
      [{ type: "text" as const, prompt: "Say", suggestions: [{ label: "A" }] }],
      "takes no suggestions",
    ],
    [[{ prompt: "  " }], "is empty"],
    [
      [
        { id: "x", prompt: "One" },
        { id: "x", prompt: "Two" },
      ],
      "two questions",
    ],
    [
      [
        {
          prompt: "Pick",
          suggestions: [
            { label: "A", recommended: true },
            { label: "B", recommended: true },
          ],
        },
      ],
      "at most one",
    ],
    [[{ prompt: "Look", pictures: ["pic-9"] }], "not on this task"],
    [[{ prompt: "Look", pictures: ["pic-1"] }, layout], "used twice"],
  ])("refuses %j", (questions, message) => {
    expect(
      refusal(post({ questions: questions as QuestionDraft[] }))?.message,
    ).toMatch(new RegExp(message, "i"));
  });

  it("lets a multiple-choice question recommend several suggestions", () => {
    const round = post({
      questions: [
        {
          type: "multiple",
          prompt: "Which fields become labels?",
          suggestions: [
            { label: "Components", recommended: true },
            { label: "Priority", recommended: true },
          ],
        },
      ],
    });
    expect(round.ok).toBe(true);
  });
});

describe("answering a round", () => {
  const pictures = new Set(["pic-1", "pic-2", "pic-3"]);

  it("keeps each answer in question order and counts skipped ones out", () => {
    const round = unwrap(post());
    round.pullDomainEvents();
    unwrap(
      round.answer(
        [
          {
            questionId: "layout",
            choices: ["a"],
            text: "  Keep the epic colour.  ",
            pictures: ["pic-3"],
          },
        ],
        daniel,
        pictures,
        now,
      ),
    );
    expect(round.status).toBe("answered");
    expect(round.state.answers).toEqual([
      {
        questionId: "layout",
        choices: ["a"],
        text: "Keep the epic colour.",
        pictures: ["pic-3"],
        skipped: false,
      },
      {
        questionId: "q2",
        choices: [],
        text: null,
        pictures: [],
        skipped: true,
      },
    ]);
    expect(round.answeredCount).toBe(1);
    expect(round.state.answeredBy).toEqual(daniel);
    expect(round.pullDomainEvents()).toEqual([
      expect.any(QuestionnaireAnswered),
    ]);
  });

  it("answers once: a second submit names who answered first", () => {
    const round = unwrap(post());
    unwrap(round.answer([], daniel, pictures, now));
    const again = round.answer([], { ...daniel, name: "Hana" }, pictures, now);
    expect(isErr(again) && again.error).toMatchObject({
      code: "questionnaire-closed",
      message: expect.stringContaining("Daniel"),
    });
  });

  it.each([
    [{ questionId: "nope" }, "no question"],
    [{ questionId: "layout", choices: ["z"] }, "no suggestion"],
    [{ questionId: "layout", choices: ["a", "b"] }, "pick one"],
    [{ questionId: "layout", pictures: ["pic-1"] }, "used twice"],
    [{ questionId: "layout", pictures: ["pic-8"] }, "not on this task"],
  ])("refuses %j", (answer, message) => {
    const round = unwrap(post());
    const answered = round.answer([answer], daniel, pictures, now);
    expect(isErr(answered) && answered.error.message).toMatch(
      new RegExp(message, "i"),
    );
    expect(round.status).toBe("open");
  });

  it("is a person's to answer, not an agent's", () => {
    const round = unwrap(post());
    expect(round.answer([], agent, pictures, now).ok).toBe(false);
  });
});

describe("withdrawing a round", () => {
  it("closes it for good, with the agent's reason", () => {
    const round = unwrap(post());
    round.pullDomainEvents();
    unwrap(round.withdraw("Found it in the docs", now));
    expect(round.state).toMatchObject({
      status: "withdrawn",
      withdrawnReason: "Found it in the docs",
      withdrawnAt: now,
    });
    expect(round.pullDomainEvents()).toEqual([
      expect.any(QuestionnaireWithdrawn),
    ]);
    expect(round.answer([], daniel, new Set(), now).ok).toBe(false);
    expect(round.withdraw(null, now).ok).toBe(false);
  });
});
