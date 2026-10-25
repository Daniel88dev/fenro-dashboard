import type { AnswerNotifications } from "@/modules/tasks/application/ports/answer-notifications";

export class InProcessAnswerNotifications implements AnswerNotifications {
  readonly #waiting = new Map<string, Set<() => void>>();

  settled(questionnaireId: string): void {
    const waiting = this.#waiting.get(questionnaireId);
    if (!waiting) return;
    this.#waiting.delete(questionnaireId);
    for (const wake of waiting) wake();
  }

  waitFor(
    questionnaireId: string,
    ms: number,
    signal?: AbortSignal,
  ): Promise<void> {
    return new Promise((resolve) => {
      const waiting = this.#waiting.get(questionnaireId) ?? new Set();
      this.#waiting.set(questionnaireId, waiting);
      const wake = () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", wake);
        waiting.delete(wake);
        if (
          waiting.size === 0 &&
          this.#waiting.get(questionnaireId) === waiting
        ) {
          this.#waiting.delete(questionnaireId);
        }
        resolve();
      };
      const timer = setTimeout(wake, ms);
      signal?.addEventListener("abort", wake);
      waiting.add(wake);
    });
  }
}
