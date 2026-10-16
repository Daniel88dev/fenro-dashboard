/**
 * Numbered within the task and never renumbered, so "criterion 2" means
 * the same thing to every session even after others are removed.
 */
export type AcceptanceCriterion = {
  readonly number: number;
  readonly text: string;
  readonly metAt: Date | null;
  readonly evidence: string | null;
};

export const CRITERION_TEXT_LIMIT = 500;
