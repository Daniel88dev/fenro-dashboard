import {
  questionnaireNotFound,
  readTaskKey,
  taskNotFound,
  type TaskError,
} from "@/modules/tasks/domain";
import type { Query, QueryHandler } from "@/shared/application";
import { err, ok, type Result } from "@/shared/domain";

import type { AnswerNotifications } from "../ports/answer-notifications";
import type { TaskReadStore } from "../ports/task-read-store";
import {
  matchesKey,
  pictureItem,
  questionnaireItem,
  taskKey,
  TaskIndex,
} from "./projections";
import type { QuestionnaireItem } from "./read-models";

export type QuestionnaireView = {
  readonly task: string;
  readonly questionnaire: QuestionnaireItem;
};

export type QuestionnaireResult = Result<QuestionnaireView, TaskError>;

/** Without a round, the task's latest. */
export type QuestionnaireQuery = Query<
  "tasks.questionnaire",
  QuestionnaireResult
> & {
  readonly ownerId: string;
  readonly task: string;
  readonly round?: number;
};

export function questionnaireQuery(
  ownerId: string,
  task: string,
  round?: number,
): QuestionnaireQuery {
  return { type: "tasks.questionnaire", ownerId, task, round };
}

async function readRound(
  store: TaskReadStore,
  clock: () => Date,
  query: { ownerId: string; task: string; round?: number },
): Promise<QuestionnaireResult> {
  const index = new TaskIndex(await store.records(query.ownerId), clock());
  const reference = query.task.trim();
  let record = index.get(reference.toLowerCase());
  if (!record) {
    const key = readTaskKey(reference);
    if (!key.ok) return key;
    record = index.records.find((candidate) =>
      matchesKey(candidate, key.value),
    );
  }
  const detail = record
    ? await store.detail(query.ownerId, record.id)
    : undefined;
  if (!detail) return err(taskNotFound(reference));

  const key = taskKey(detail);
  const round =
    query.round === undefined
      ? detail.questionnaires.at(-1)
      : detail.questionnaires.find((round) => round.number === query.round);
  if (!round) {
    return err(
      questionnaireNotFound(
        query.round === undefined ? `on ${key}` : `${key}/${query.round}`,
      ),
    );
  }
  const pictures = new Map(
    detail.pictures.map((picture) => [picture.id, pictureItem(picture)]),
  );
  return ok({ task: key, questionnaire: questionnaireItem(round, pictures) });
}

export class QuestionnaireHandler implements QueryHandler<
  QuestionnaireQuery,
  QuestionnaireResult
> {
  constructor(
    private readonly tasks: TaskReadStore,
    private readonly clock: () => Date,
  ) {}

  handle(query: QuestionnaireQuery): Promise<QuestionnaireResult> {
    return readRound(this.tasks, this.clock, query);
  }
}

/**
 * How long an agent keeps waiting on one round before it hands the task
 * back: an instance held awake by a waiting call is billed by the minute.
 */
export const WAIT_BUDGET_MS = 15 * 60 * 1000;
export const MAX_WAIT_SECONDS = 50;

export type WaitView = QuestionnaireView & {
  readonly waitedSeconds: number;
  /** When the agent should stop waiting and finish its session paused. */
  readonly waitUntil: string;
  readonly budgetSpent: boolean;
};

export type WaitResult = Result<WaitView, TaskError>;

export type WaitForAnswersQuery = Query<
  "tasks.wait-for-answers",
  WaitResult
> & {
  readonly ownerId: string;
  readonly task: string;
  readonly round?: number;
  readonly seconds: number;
};

export function waitForAnswersQuery(
  ownerId: string,
  task: string,
  round: number | undefined,
  seconds: number,
): WaitForAnswersQuery {
  return { type: "tasks.wait-for-answers", ownerId, task, round, seconds };
}

export class WaitForAnswersHandler implements QueryHandler<
  WaitForAnswersQuery,
  WaitResult
> {
  constructor(
    private readonly tasks: TaskReadStore,
    private readonly notifications: AnswerNotifications,
    private readonly clock: () => Date,
  ) {}

  async handle(query: WaitForAnswersQuery): Promise<WaitResult> {
    const first = await readRound(this.tasks, this.clock, query);
    if (!first.ok) return first;
    const { questionnaire } = first.value;
    const deadline = Date.parse(questionnaire.postedAt) + WAIT_BUDGET_MS;
    const waitUntil = new Date(deadline).toISOString();
    const started = this.clock().getTime();
    const left = deadline - started;
    if (questionnaire.status !== "open" || left <= 0) {
      return ok({
        ...first.value,
        waitedSeconds: 0,
        waitUntil,
        budgetSpent: questionnaire.status === "open",
      });
    }

    const seconds = Math.min(Math.max(query.seconds, 1), MAX_WAIT_SECONDS);
    const round = { ...query, round: questionnaire.round };
    // Listen before reading again, so an answer saved between the two reads
    // either shows in the second one or wakes the wait.
    const stop = new AbortController();
    const woken = this.notifications.waitFor(
      questionnaire.id,
      Math.min(seconds * 1000, left),
      stop.signal,
    );
    let second = await readRound(this.tasks, this.clock, round);
    if (second.ok && second.value.questionnaire.status === "open") {
      await woken;
      second = await readRound(this.tasks, this.clock, round);
    }
    stop.abort();
    if (!second.ok) return second;
    const ended = this.clock().getTime();
    return ok({
      ...second.value,
      waitedSeconds: Math.round((ended - started) / 1000),
      waitUntil,
      budgetSpent:
        second.value.questionnaire.status === "open" && ended >= deadline,
    });
  }
}
