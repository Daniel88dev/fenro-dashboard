import {
  isOpen,
  Questionnaire,
  sameActor,
  taskError,
  type PictureRepository,
  type QuestionDraft,
  type QuestionnaireRepository,
  type TaskError,
  type TaskRepository,
} from "@/modules/tasks/domain";
import type { CommandHandler } from "@/shared/application";
import { err, ok, type Result } from "@/shared/domain";

import {
  findTask,
  type TaskCommand,
  type TaskReference,
} from "./task-commands";

export type PostQuestionnaireCommand =
  TaskCommand<"tasks.post-questionnaire"> & {
    readonly questionnaireId: string;
    readonly task: TaskReference;
    readonly title: string;
    readonly intro?: string | null;
    readonly questions: readonly QuestionDraft[];
  };

const ATTEMPTS = 3;

export class PostQuestionnaireHandler implements CommandHandler<PostQuestionnaireCommand> {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly questionnaires: QuestionnaireRepository,
    private readonly pictures: PictureRepository,
    private readonly clock: () => Date,
  ) {}

  async handle(
    command: PostQuestionnaireCommand,
  ): Promise<Result<void, TaskError>> {
    const found = await findTask(this.tasks, command.ownerId, command.task);
    if (!found.ok) return found;
    const task = found.value;
    const now = this.clock();
    if (!isOpen(task.status)) {
      return err(
        taskError(
          "invalid-questionnaire",
          `${task.key} is ${task.status}, so it takes no questions. Reopen it first.`,
        ),
      );
    }
    const claim = task.checkClaim(command.actor, now);
    if (!claim.ok) return claim;

    const live = task.liveSession(now);
    const taskPictures = new Set(
      await this.pictures.idsOnTask(command.ownerId, task.id.value),
    );
    let last: Result<void, TaskError> = ok(undefined);
    for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
      const open = await this.questionnaires.openRound(
        command.ownerId,
        task.id.value,
      );
      if (open?.id.value === command.questionnaireId) return ok(undefined);
      if (open) {
        return err(
          taskError(
            "questionnaire-open",
            `Round ${open.number} on ${task.key} is still open. Wait for its answers, or withdraw it with withdraw_questions before asking again.`,
          ),
        );
      }
      const posted = Questionnaire.post({
        id: command.questionnaireId,
        ownerId: command.ownerId,
        taskId: task.id.value,
        number: await this.questionnaires.nextNumber(task.id.value),
        title: command.title,
        intro: command.intro,
        questions: command.questions,
        postedBy: command.actor,
        sessionId:
          live && sameActor(live.actor, command.actor) ? live.id : null,
        taskPictures,
        now,
      });
      if (!posted.ok) return posted;
      last = await this.questionnaires.save(posted.value);
      if (last.ok) {
        posted.value.pullDomainEvents();
        return last;
      }
      if (last.error.code !== "concurrent-modification") return last;
    }
    return last;
  }
}
