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
