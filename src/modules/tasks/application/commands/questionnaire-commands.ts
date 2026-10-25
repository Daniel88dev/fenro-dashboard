import {
  questionnaireNotFound,
  QuestionnaireAnswered,
  QuestionnaireWithdrawn,
  type AnswerDraft,
  type PictureRepository,
  type Questionnaire,
  type QuestionnaireRepository,
  type TaskError,
  type TaskRepository,
} from "@/modules/tasks/domain";
import type { CommandHandler } from "@/shared/application";
import { err, type Result } from "@/shared/domain";

import type { AnswerNotifications } from "../ports/answer-notifications";
import {
  findTask,
  type TaskCommand,
  type TaskReference,
} from "./task-commands";

type RoundCommand<TType extends string> = TaskCommand<TType> & {
  readonly task: TaskReference;
  readonly round: number;
};

export type AnswerQuestionnaireCommand =
  RoundCommand<"tasks.answer-questionnaire"> & {
    readonly answers: readonly AnswerDraft[];
  };

export type WithdrawQuestionnaireCommand =
  RoundCommand<"tasks.withdraw-questionnaire"> & {
    readonly reason?: string | null;
  };

async function changeRound(
  tasks: TaskRepository,
  questionnaires: QuestionnaireRepository,
  notifications: AnswerNotifications,
  command: RoundCommand<string>,
  change: (
    round: Questionnaire,
    taskId: string,
  ) => Promise<Result<void, TaskError>> | Result<void, TaskError>,
): Promise<Result<void, TaskError>> {
  const task = await findTask(tasks, command.ownerId, command.task);
  if (!task.ok) return task;
  const taskId = task.value.id.value;

  // A lost race reloads the round, which then refuses as already answered.
  let saved: Result<void, TaskError> | undefined;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const round = await questionnaires.round(
      command.ownerId,
      taskId,
      command.round,
    );
    if (!round) {
      return err(questionnaireNotFound(`${task.value.key}/${command.round}`));
    }
    const changed = await change(round, taskId);
    if (!changed.ok) return changed;
    saved = await questionnaires.save(round);
    if (saved.ok) {
      for (const event of round.pullDomainEvents()) {
        if (
          event instanceof QuestionnaireAnswered ||
          event instanceof QuestionnaireWithdrawn
        ) {
          notifications.settled(round.id.value);
        }
      }
      return saved;
    }
    if (saved.error.code !== "concurrent-modification") return saved;
  }
  return saved!;
}

export class AnswerQuestionnaireHandler implements CommandHandler<AnswerQuestionnaireCommand> {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly questionnaires: QuestionnaireRepository,
    private readonly pictures: PictureRepository,
    private readonly notifications: AnswerNotifications,
    private readonly clock: () => Date,
  ) {}

  handle(
    command: AnswerQuestionnaireCommand,
  ): Promise<Result<void, TaskError>> {
    return changeRound(
      this.tasks,
      this.questionnaires,
      this.notifications,
      command,
      async (round, taskId) =>
        round.answer(
          command.answers,
          command.actor,
          new Set(await this.pictures.idsOnTask(command.ownerId, taskId)),
          this.clock(),
        ),
    );
  }
}

export class WithdrawQuestionnaireHandler implements CommandHandler<WithdrawQuestionnaireCommand> {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly questionnaires: QuestionnaireRepository,
    private readonly notifications: AnswerNotifications,
    private readonly clock: () => Date,
  ) {}

  async handle(
    command: WithdrawQuestionnaireCommand,
  ): Promise<Result<void, TaskError>> {
    const task = await findTask(this.tasks, command.ownerId, command.task);
    if (!task.ok) return task;
    const claim = task.value.checkClaim(command.actor, this.clock());
    if (!claim.ok) return claim;
    return changeRound(
      this.tasks,
      this.questionnaires,
      this.notifications,
      command,
      (round) => round.withdraw(command.reason ?? null, this.clock()),
    );
  }
}
