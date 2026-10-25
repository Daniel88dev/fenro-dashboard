/**
 * Wakes calls waiting on a round of questions. In-process for now, as the
 * app runs on one instance; with more, a Postgres LISTEN/NOTIFY adapter
 * takes its place.
 */
export interface AnswerNotifications {
  settled(questionnaireId: string): void;
  /** Resolves when the round settles, `ms` pass or `signal` aborts. */
  waitFor(
    questionnaireId: string,
    ms: number,
    signal?: AbortSignal,
  ): Promise<void>;
}
