import { and, eq, max } from "drizzle-orm";

import {
  Questionnaire,
  taskError,
  type QuestionnaireRepository,
  type TaskError,
} from "@/modules/tasks/domain";
import { err, ok, UniqueId, type Result } from "@/shared/domain";
import type { Database } from "@/shared/infrastructure/database/client";

import {
  taskQuestionnaire,
  taskQuestionnairePicture,
} from "./persistence/schema";
import {
  pictureLinks,
  stateOf,
  storedAnswers,
  storedQuestions,
  type QuestionnaireRow,
} from "./questionnaire-rows";

export class DrizzleQuestionnaireRepository implements QuestionnaireRepository {
  readonly #loadedVersions = new WeakMap<Questionnaire, number>();

  constructor(private readonly db: Database) {}

  async round(
    ownerId: string,
    taskId: string,
    number: number,
  ): Promise<Questionnaire | undefined> {
    const [row] = await this.db
      .select()
      .from(taskQuestionnaire)
      .where(
        and(
          eq(taskQuestionnaire.ownerId, ownerId),
          eq(taskQuestionnaire.taskId, taskId),
          eq(taskQuestionnaire.number, number),
        ),
      );
    return row ? this.#restore(row) : undefined;
  }

  async openRound(
    ownerId: string,
    taskId: string,
  ): Promise<Questionnaire | undefined> {
    const [row] = await this.db
      .select()
      .from(taskQuestionnaire)
      .where(
        and(
          eq(taskQuestionnaire.ownerId, ownerId),
          eq(taskQuestionnaire.taskId, taskId),
          eq(taskQuestionnaire.status, "open"),
        ),
      );
    return row ? this.#restore(row) : undefined;
  }

  async nextNumber(taskId: string): Promise<number> {
    const [row] = await this.db
      .select({ last: max(taskQuestionnaire.number) })
      .from(taskQuestionnaire)
      .where(eq(taskQuestionnaire.taskId, taskId));
    return (row?.last ?? 0) + 1;
  }

  async save(questionnaire: Questionnaire): Promise<Result<void, TaskError>> {
    const loaded = this.#loadedVersions.get(questionnaire);
    const { state } = questionnaire;
    const id = questionnaire.id.value;
    const values = {
      id,
      ownerId: questionnaire.ownerId,
      taskId: questionnaire.taskId,
      number: questionnaire.number,
      title: state.title,
      intro: state.intro,
      status: state.status,
      questions: storedQuestions(state.questions),
      answers: storedAnswers(state.answers),
      questionCount: state.questions.length,
      answeredCount: questionnaire.answeredCount,
      postedByKind: state.postedBy.kind,
      postedById: state.postedBy.id,
      postedByName: state.postedBy.name,
      sessionId: state.sessionId,
      postedAt: state.postedAt,
      answeredByKind: state.answeredBy?.kind ?? null,
      answeredById: state.answeredBy?.id ?? null,
      answeredByName: state.answeredBy?.name ?? null,
      answeredAt: state.answeredAt,
      withdrawnAt: state.withdrawnAt,
      withdrawnReason: state.withdrawnReason,
    };

    const version = await this.db.transaction(async (tx) => {
      // No conflict target: a taken number and a second open round on the
      // task are both a race this save lost.
      const [saved] =
        loaded === undefined
          ? await tx
              .insert(taskQuestionnaire)
              .values({ ...values, version: 1 })
              .onConflictDoNothing()
              .returning({ version: taskQuestionnaire.version })
          : await tx
              .update(taskQuestionnaire)
              .set({ ...values, version: loaded + 1 })
              .where(
                and(
                  eq(taskQuestionnaire.id, id),
                  eq(taskQuestionnaire.version, loaded),
                ),
              )
              .returning({ version: taskQuestionnaire.version });
      if (!saved) return undefined;

      await tx
        .delete(taskQuestionnairePicture)
        .where(eq(taskQuestionnairePicture.questionnaireId, id));
      const links = pictureLinks(id, state);
      if (links.length > 0) {
        await tx.insert(taskQuestionnairePicture).values(links);
      }
      return saved.version;
    });

    if (version === undefined) {
      return err(
        taskError(
          "concurrent-modification",
          `Round ${questionnaire.number} changed while this was being saved. Read it again and retry.`,
        ),
      );
    }
    this.#loadedVersions.set(questionnaire, version);
    return ok(undefined);
  }

  async #restore(row: QuestionnaireRow): Promise<Questionnaire> {
    const links = await this.db
      .select()
      .from(taskQuestionnairePicture)
      .where(eq(taskQuestionnairePicture.questionnaireId, row.id));
    const questionnaire = Questionnaire.restore(
      UniqueId.create(row.id),
      { ownerId: row.ownerId, taskId: row.taskId, number: row.number },
      stateOf(row, links),
    );
    this.#loadedVersions.set(questionnaire, row.version);
    return questionnaire;
  }
}
