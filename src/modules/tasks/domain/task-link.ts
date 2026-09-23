/**
 * How one task relates to another, stored on the task the sentence is about:
 * "T-5 is blocked by T-3" lives on T-5.
 *
 * - `blocked-by` is the only kind that holds work back.
 * - `relates-to` is a pointer, read in both directions.
 * - `discovered-from` records that the task was found while working another,
 *   so a follow-up keeps its provenance without derailing the task in hand.
 *
 * Parenthood is not a link: it is the task's `parentId`, because a task has
 * one parent at most and a parent reads its children's progress.
 */
export const LINK_KINDS = [
  "blocked-by",
  "relates-to",
  "discovered-from",
] as const;

export type LinkKind = (typeof LINK_KINDS)[number];

export type TaskLink = {
  readonly kind: LinkKind;
  readonly taskId: string;
};
