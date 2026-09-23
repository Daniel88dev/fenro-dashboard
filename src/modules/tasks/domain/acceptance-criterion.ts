/**
 * One condition the task must meet to be done: the agent's objective finish
 * line. Numbered within the task and never renumbered, so "criterion 2" means
 * the same thing to every session even after others are removed.
 */
export type AcceptanceCriterion = {
  readonly number: number;
  readonly text: string;
  readonly metAt: Date | null;
  /** How it was shown to be met: "tests pass in CI run 4121". */
  readonly evidence: string | null;
};

export const CRITERION_TEXT_LIMIT = 500;
