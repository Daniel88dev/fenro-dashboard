import type { Result } from "@/shared/domain";

import type { TaskError } from "./errors";
import type { Questionnaire } from "./questionnaire";

export interface QuestionnaireRepository {
  round(
    ownerId: string,
    taskId: string,
    number: number,
  ): Promise<Questionnaire | undefined>;
  openRound(
    ownerId: string,
    taskId: string,
  ): Promise<Questionnaire | undefined>;
  nextNumber(taskId: string): Promise<number>;
  /**
   * Refuses with `concurrent-modification` when the round changed since it
   * was read, or another round took its number or the task's one open slot.
   */
  save(questionnaire: Questionnaire): Promise<Result<void, TaskError>>;
}
