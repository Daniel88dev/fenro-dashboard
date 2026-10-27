import type { AssigneeItem } from "@/modules/tasks/application/queries/read-models";

export type Reader = { readonly id: string; readonly login: string };

const SIZES = {
  sm: { px: 20, className: "size-5" },
  md: { px: 22, className: "size-[22px]" },
  lg: { px: 24, className: "size-6" },
} as const;

export type AvatarSize = keyof typeof SIZES;

export function Avatar({
  login,
  size = "md",
}: {
  login: string | null;
  size?: AvatarSize;
}) {
  const { px, className } = SIZES[size];
  if (!login) {
    return (
      <span
        aria-hidden="true"
        className={`${className} border-state-backlog-line inline-block shrink-0 rounded-full border-[1.5px] border-dashed`}
      />
    );
  }
  return (
    // A small GitHub avatar gains nothing from next/image, which would also
    // need GitHub added to the image domains.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://github.com/${encodeURIComponent(login)}.png?size=${px * 2}`}
      alt=""
      width={px}
      height={px}
      loading="lazy"
      className={`${className} bg-surface-sunken ring-hairline shrink-0 rounded-full ring-1`}
    />
  );
}

export function assigneeLogin(
  assignee: AssigneeItem | null,
  you?: Reader,
): string | null {
  if (!assignee) return null;
  return assignee.login ?? (assignee.id === you?.id ? you.login : null);
}

export function assigneeWords(
  assignee: AssigneeItem | null,
  you?: Reader,
): string {
  if (!assignee) return "Unassigned";
  if (assignee.id === you?.id) return "You";
  return assignee.login ?? "Unassigned";
}
