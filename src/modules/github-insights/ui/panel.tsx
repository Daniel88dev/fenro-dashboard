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
  action,
}: {
  id: string;
  title: string;
  message: string;
  action?: ReactNode;
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
        className="border-issue-wash bg-issue-wash text-issue-strong flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border px-3 py-2 text-[12px]"
      >
        <span>{message}</span>
        {action}
      </p>
    </div>
  );
}

/**
 * A panel whose detail is still on its way: the same chrome, so the row does
 * not jump when it lands, and a few grey lines where the list will be.
 */
export function PanelLoading({
  id,
  title,
  what,
}: {
  id: string;
  title: string;
  what: string;
}) {
  return (
    <div
      id={id}
      aria-busy="true"
      className="border-hairline-soft bg-surface-raised border-t px-[18px] pt-1 pb-4"
    >
      <div className="flex items-baseline gap-2.5 py-2">
        <h3 className="text-ink text-[12.5px] font-medium">{title}</h3>
        <p role="status" className="text-ink-muted text-[11.5px]">
          {`Loading ${what}…`}
        </p>
      </div>
      <div aria-hidden className="flex flex-col gap-1.5">
        {[0, 1, 2].map((line) => (
          <div
            key={line}
            className="border-hairline bg-surface flex h-[41px] items-center gap-3 rounded-[9px] border px-[13px]"
          >
            <span className="bg-surface-sunken h-2.5 w-10 rounded motion-safe:animate-pulse" />
            <span className="bg-surface-sunken h-2.5 w-1/2 rounded motion-safe:animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

const CHECKS_TONES = {
  attention: "border-issue-wash bg-issue-wash text-issue-strong",
  neutral: "border-hairline bg-surface-raised text-ink-muted",
} as const;

/** Where a pull request's checks would be, saying why they are not. */
export function ChecksMessage({
  id,
  tone,
  children,
}: {
  id: string;
  tone: keyof typeof CHECKS_TONES;
  children: ReactNode;
}) {
  return (
    <div id={id} className="pt-0.5 pr-3 pb-3 pl-[67px]">
      <p
        role="status"
        className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border px-3 py-2 text-[12px] ${CHECKS_TONES[tone]}`}
      >
        {children}
      </p>
    </div>
  );
}

export function ChecksLoading({ id, number }: { id: string; number: number }) {
  return (
    <div
      id={id}
      aria-busy="true"
      className="pt-0.5 pr-3 pb-3 pl-[67px] text-[12px]"
    >
      <p role="status" className="text-ink-muted pt-1.5">
        {`Loading the checks for #${number}…`}
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
