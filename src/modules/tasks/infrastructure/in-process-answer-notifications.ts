import type { AnswerNotifications } from "@/modules/tasks/application/ports/answer-notifications";

// Next.js bundles route handlers and server actions separately, each with its
// own copy of this module, so the one instance per process lives on globalThis:
// otherwise an answer from the task page never wakes a waiting MCP request.
const SHARED = Symbol.for("fenro.answer-notifications");

export class InProcessAnswerNotifications implements AnswerNotifications {
  static shared(): AnswerNotifications {
    const scope = globalThis as { [SHARED]?: AnswerNotifications };
    scope[SHARED] ??= new InProcessAnswerNotifications();
    return scope[SHARED];
  }

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
