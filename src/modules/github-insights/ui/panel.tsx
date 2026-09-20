import type { ReactNode } from "react";

/** The chrome every expanded panel shares: a title, a summary, then the list. */
export function Panel({
  id,
  title,
  summary,
  children,
  footer,
}: {
  id: string;
  title: string;
  summary: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div
      id={id}
      className="border-hairline-soft bg-surface-raised border-t px-[18px] pt-1 pb-4"
    >
      <div className="flex items-baseline gap-2.5 py-2">
        <h3 className="text-ink text-[12.5px] font-medium">{title}</h3>
        <p className="text-ink-muted text-[11.5px]">{summary}</p>
      </div>
      <div className="flex flex-col gap-1.5">{children}</div>
      {footer ? <div className="pt-2.5 text-[11.5px]">{footer}</div> : null}
    </div>
  );
}

/** One panel failing must not take the table down with it. */
export function PanelError({
  id,
  title,
  message,
}: {
  id: string;
  title: string;
  message: string;
}) {
  return (
    <div
      id={id}
      className="border-hairline-soft bg-surface-raised border-t px-[18px] pt-1 pb-4"
    >
      <div className="flex items-baseline gap-2.5 py-2">
        <h3 className="text-ink text-[12.5px] font-medium">{title}</h3>
      </div>
      <p
        role="status"
        className="border-issue-wash bg-issue-wash text-issue-strong rounded-lg border px-3 py-2 text-[12px]"
      >
        {message}
      </p>
    </div>
  );
}

export function MoreOnGitHub({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      rel="noreferrer noopener"
      target="_blank"
      className="text-pr hover:text-pr-strong underline-offset-2 hover:underline"
    >
      {children}
    </a>
  );
}
