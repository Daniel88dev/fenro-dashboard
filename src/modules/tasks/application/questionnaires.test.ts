import { beforeEach, describe, expect, it } from "vitest";

import type { Actor } from "@/modules/tasks/domain";
import { InMemoryPictureStorage } from "@/modules/tasks/infrastructure/in-memory-picture.storage";
import { InMemoryTaskStore } from "@/modules/tasks/infrastructure/in-memory-task.store";
import { InProcessAnswerNotifications } from "@/modules/tasks/infrastructure/in-process-answer-notifications";

import { AddPictureHandler } from "./commands/add-picture";
import { ChangeStatusHandler } from "./commands/change-status";
import { CreateTaskHandler } from "./commands/create-task";
import { FinishSessionHandler } from "./commands/finish-session";
import {
  PostQuestionnaireHandler,
  type PostQuestionnaireCommand,
} from "./commands/post-questionnaire";
import {
  AnswerQuestionnaireHandler,
  WithdrawQuestionnaireHandler,
  type AnswerQuestionnaireCommand,
} from "./commands/questionnaire-commands";
import { StartTaskHandler } from "./commands/start-task";
import { ListTasksHandler, listTasksQuery } from "./queries/list-tasks";
import {
  QuestionnaireHandler,
  questionnaireQuery,
  WAIT_BUDGET_MS,
  WaitForAnswersHandler,
  waitForAnswersQuery,
} from "./queries/questionnaire";
import { TaskBriefHandler, taskBriefQuery } from "./queries/task-brief";

const OWNER = "user-1";
const DANIEL: Actor = { kind: "human", id: OWNER, name: "Daniel" };
const AGENT: Actor = { kind: "agent", id: "token-1", name: "claude-code" };
const OTHER_AGENT: Actor = { kind: "agent", id: "token-2", name: "cursor" };
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);

let now: Date;
let store: InMemoryTaskStore;
let notifications: InProcessAnswerNotifications;
let ids: number;
const clock = () => now;

const nextId = (prefix: string) => {
  ids += 1;
  return `00000000-0000-4000-${prefix}-${String(ids).padStart(12, "0")}`;
};

beforeEach(async () => {
  now = new Date("2026-10-25T10:00:00Z");
  store = new InMemoryTaskStore();
  notifications = new InProcessAnswerNotifications();
  ids = 0;
  await new CreateTaskHandler(store, store, clock).handle({
    type: "tasks.create-task",
    ownerId: OWNER,
    actor: DANIEL,
    taskId: nextId("8000"),
    title: "Import Jira issues",
  });
});

const repository = () => store.questionnaireRepository;

const start = (actor: Actor = AGENT) =>
  new StartTaskHandler(store, clock).handle({
    type: "tasks.start-task",
    ownerId: OWNER,
    actor,
    task: "T-1",
  });

async function addPicture(by: Actor = AGENT) {
  const pictureId = nextId("9000");
  await new AddPictureHandler(
    store,
    store,
    new InMemoryPictureStorage(),
    clock,
  ).handle({
    type: "tasks.add-picture",
    ownerId: OWNER,
    actor: by,
    pictureId,
    task: "T-1",
    fileName: "layout.png",
    bytes: PNG,
  });
  return pictureId;
}

const ask = (fields: Partial<PostQuestionnaireCommand> = {}) =>
  new PostQuestionnaireHandler(store, repository(), store, clock).handle({
    type: "tasks.post-questionnaire",
    ownerId: OWNER,
    actor: AGENT,
    questionnaireId: nextId("a000"),
    task: "T-1",
    title: "Import scope",
    questions: [
      {
        id: "scope",
        prompt: "Which issues come in?",
        suggestions: [
          { label: "Assigned to me", recommended: true },
          { label: "The whole project" },
        ],
      },
      { id: "notes", prompt: "Anything about your Jira setup?" },
    ],
    ...fields,
  });

const answer = (fields: Partial<AnswerQuestionnaireCommand> = {}) =>
  new AnswerQuestionnaireHandler(
    store,
    repository(),
    store,
    notifications,
    clock,
  ).handle({
    type: "tasks.answer-questionnaire",
    ownerId: OWNER,
    actor: DANIEL,
    task: "T-1",
    round: 1,
    answers: [{ questionId: "scope", choices: ["a"], text: "Only FEN." }],
    ...fields,
  });

const withdraw = (actor: Actor = AGENT) =>
  new WithdrawQuestionnaireHandler(
    store,
    repository(),
    notifications,
    clock,
  ).handle({
    type: "tasks.withdraw-questionnaire",
    ownerId: OWNER,
    actor,
    task: "T-1",
    round: 1,
    reason: "Found it in the docs",
  });

async function brief() {
  const found = await new TaskBriefHandler(store, clock).handle(
    taskBriefQuery(OWNER, "T-1"),
  );
  if (!found.ok) throw new Error(found.error.message);
  return found.value;
}

const waitFor = (seconds: number) =>
  new WaitForAnswersHandler(store, notifications, clock).handle(
    waitForAnswersQuery(OWNER, "T-1", 1, seconds),
  );

describe("posting a round", () => {
  it("lists the round on the task, tied to the agent's session", async () => {
    await start();
    expect((await ask()).ok).toBe(true);

    const task = await brief();
    expect(task.questionnaires).toHaveLength(1);
    expect(task.questionnaires[0]).toMatchObject({
      round: 1,
      title: "Import scope",
      status: "open",
      postedBy: "claude-code",
      session: 1,
      answers: null,
      answered: 0,
    });
    expect(task.state).toBe("running");
  });

  it("blocks the task until it is answered, and leaves the ready queue", async () => {
    await start();
    await ask();
    await new FinishSessionHandler(store, clock).handle({
      type: "tasks.finish-session",
      ownerId: OWNER,
      actor: AGENT,
      task: "T-1",
      outcome: "paused",
      summary: "Waiting on Daniel's answers.",
    });

    const list = new ListTasksHandler(store, clock);
    expect((await brief()).state).toBe("blocked");
    expect(
      (await list.handle(listTasksQuery(OWNER, { ready: true }))).total,
    ).toBe(0);
    const needing = await list.handle(
      listTasksQuery(OWNER, { needsAnswer: true }),
    );
    expect(needing.tasks.map((task) => [task.key, task.questions])).toEqual([
      ["T-1", 2],
    ]);

    await answer();
    expect((await brief()).state).toBe("paused");
    expect(
      (await list.handle(listTasksQuery(OWNER, { needsAnswer: true }))).total,
    ).toBe(0);
  });

  it("takes one open round per task", async () => {
    await ask();
    const second = await ask();
    expect(!second.ok && second.error.code).toBe("questionnaire-open");
    await withdraw();
    expect((await ask()).ok).toBe(true);
    expect((await brief()).questionnaires.map((round) => round.round)).toEqual([
      1, 2,
    ]);
  });

  it("posts the same round once when the call is retried", async () => {
    const questionnaireId = nextId("a000");
    expect((await ask({ questionnaireId })).ok).toBe(true);
    expect((await ask({ questionnaireId })).ok).toBe(true);
    expect((await brief()).questionnaires).toHaveLength(1);
  });

  it("refuses an agent while another agent holds the task", async () => {
    await start(OTHER_AGENT);
    const posted = await ask();
    expect(!posted.ok && posted.error.code).toBe("task-claimed");
  });

  it("refuses a closed task", async () => {
    await new ChangeStatusHandler(store, clock).handle({
      type: "tasks.change-status",
      ownerId: OWNER,
      actor: DANIEL,
      task: "T-1",
      status: "cancelled",
    });
    const posted = await ask();
    expect(!posted.ok && posted.error.code).toBe("invalid-questionnaire");
  });

  it("shows its pictures in the round only, not among the task's own", async () => {
    const own = await addPicture(DANIEL);
    const shown = await addPicture();
    const elsewhere = await ask({
      questions: [{ prompt: "Which?", pictures: ["not-a-picture"] }],
    });
    expect(!elsewhere.ok && elsewhere.error.message).toMatch(
      /attach_picture first/,
    );

    await ask({ questions: [{ prompt: "This one?", pictures: [shown] }] });
    const task = await brief();
    expect(task.pictures.map((picture) => picture.id)).toEqual([own]);
    expect(task.questionnaires[0]?.questions[0]?.pictures).toMatchObject([
      { id: shown, name: "layout.png" },
    ]);
  });
});

describe("answering and withdrawing", () => {
  it("records the person's answers and refuses a second submit", async () => {
    await ask();
    const mine = await addPicture(DANIEL);
    expect(
      (
        await answer({
          answers: [
            { questionId: "scope", choices: ["a"], text: "Only FEN." },
            { questionId: "notes", pictures: [mine] },
          ],
        })
      ).ok,
    ).toBe(true);

    const round = (await brief()).questionnaires[0]!;
    expect(round).toMatchObject({
      status: "answered",
      answeredBy: "Daniel",
      answered: 2,
      answers: [
        { questionId: "scope", choices: ["a"], text: "Only FEN." },
        { questionId: "notes", pictures: [{ id: mine }], skipped: false },
      ],
    });
    const again = await answer();
    expect(!again.ok && again.error.code).toBe("questionnaire-closed");
  });

  it("lets the agent withdraw an open round", async () => {
    await ask();
    expect((await withdraw()).ok).toBe(true);
    expect((await brief()).questionnaires[0]).toMatchObject({
      status: "withdrawn",
      withdrawnReason: "Found it in the docs",
    });
    expect((await brief()).state).toBe("ready");
  });

  it("names a round that is not there", async () => {
    const answered = await answer({ round: 4 });
    expect(!answered.ok && answered.error.code).toBe("questionnaire-not-found");
  });
});

describe("reading and waiting for answers", () => {
  it("reads the latest round, or one by number", async () => {
    await ask();
    await withdraw();
    await ask({ title: "Second try" });
    const handler = new QuestionnaireHandler(store, clock);
    const latest = await handler.handle(questionnaireQuery(OWNER, "T-1"));
    expect(latest.ok && latest.value.questionnaire.title).toBe("Second try");
    const first = await handler.handle(questionnaireQuery(OWNER, "T-1", 1));
    expect(first.ok && first.value.questionnaire.status).toBe("withdrawn");
  });

  it("returns at once when the round is already answered", async () => {
    await ask();
    await answer();
    const waited = await waitFor(45);
    expect(waited.ok && waited.value).toMatchObject({
      waitedSeconds: 0,
      budgetSpent: false,
      questionnaire: { status: "answered" },
    });
  });

  it("wakes up as soon as the person submits", async () => {
    await ask();
    const waiting = waitFor(45);
    await answer();
    const waited = await waiting;
    expect(waited.ok && waited.value.questionnaire.status).toBe("answered");
  });

  it("stops waiting once the budget since posting is spent", async () => {
    await ask();
    now = new Date(now.getTime() + WAIT_BUDGET_MS + 1000);
    const waited = await waitFor(45);
    expect(waited.ok && waited.value).toMatchObject({
      budgetSpent: true,
      waitUntil: "2026-10-25T10:15:00.000Z",
      questionnaire: { status: "open" },
    });
  });
});
