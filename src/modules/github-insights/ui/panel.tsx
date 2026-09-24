import { ArrowRight, ArrowUpRight } from "@phosphor-icons/react/ssr";
import type { ReactNode } from "react";

import { Spinner } from "./spinner";

/**
 * The chrome every expanded panel shares: one sunken level under the row, a
 * title with its summary, then a single list. The rows inside are separated by
 * hairlines rather than boxed one by one.
 */
export function Panel({
  id,
  title,
  summary,
  action,
  children,
  footer,
}: {
  id: string;
  title: string;
  summary: ReactNode;
  /** What sits at the right of the title: Open on GitHub, New task here. */
  action?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div
      id={id}
      className="border-hairline-soft bg-surface-sunken flex flex-col gap-2.5 border-t px-3.5 pt-3.5 pb-4 md:px-5"
    >
      <PanelHeading title={title} summary={summary} action={action} />
      {children}
      {footer ? (
        <div className="text-ink-muted text-[12px]">{footer}</div>
      ) : null}
    </div>
  );
}

function PanelHeading({
  title,
  summary,
  action,
}: {
  title: string;
  summary: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
        <h3 className="text-ink text-[13px] font-semibold">{title}</h3>
        {summary}
      </div>
      {action}
    </div>
  );
}

/** The muted line beside a panel's title. */
export function PanelSummary({ children }: { children: ReactNode }) {
  return <p className="text-ink-muted text-[12px]">{children}</p>;
}

/** The one container inside a panel. */
export function PanelList({ children }: { children: ReactNode }) {
  return (
    <ul className="border-hairline bg-surface divide-hairline-soft m-0 list-none divide-y overflow-hidden rounded-xl border p-0">
      {children}
    </ul>
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
      className="border-hairline-soft bg-surface-sunken flex flex-col gap-2.5 border-t px-3.5 pt-3.5 pb-4 md:px-5"
    >
      <PanelHeading title={title} summary={null} />
      <p
        role="status"
        className="bg-issue-wash text-issue-strong flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg px-3 py-2 text-[12.5px]"
      >
        <span>{message}</span>
        {action}
      </p>
    </div>
  );
}

/**
 * A panel whose detail is still on its way: the same chrome, so the row does
 * not jump when it lands, and a line saying so. No placeholder rows: Daniel
 * asked for a quiet indicator rather than skeletons.
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
      className="border-hairline-soft bg-surface-sunken flex flex-col gap-2.5 border-t px-3.5 pt-3.5 pb-4 md:px-5"
    >
      <PanelHeading
        title={title}
        summary={
          <p
            role="status"
            className="text-ink-muted flex items-center gap-1.5 text-[12px]"
          >
            <Spinner />
            {`Loading ${what}…`}
          </p>
        }
      />
    </div>
  );
}

const CHECKS_TONES = {
  attention: "bg-issue-wash text-issue-strong",
  neutral: "bg-surface-sunken text-ink-muted",
} as const;

const CHECKS_INDENT = "px-3.5 pb-3.5 md:pl-[76px]";

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
    <div
      id={id}
      className={`bg-surface-raised border-hairline-soft border-t pt-3 ${CHECKS_INDENT}`}
    >
      <p
        role="status"
        className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg px-3 py-2 text-[12.5px] ${CHECKS_TONES[tone]}`}
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
      className={`bg-surface-raised border-hairline-soft border-t pt-3 text-[12.5px] ${CHECKS_INDENT}`}
    >
      <p role="status" className="text-ink-muted flex items-center gap-1.5">
        <Spinner />
        {`Loading the checks for #${number}…`}
      </p>
    </div>
  );
}

export { CHECKS_INDENT };

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
      className="text-pr-strong underline decoration-current/30 underline-offset-2 hover:decoration-current"
    >
      {children}
    </a>
  );
}

/** The quiet link at the right of a panel's title. */
export function OpenOnGitHub({ href, what }: { href: string; what: string }) {
  return (
    <a
      href={href}
      rel="noreferrer noopener"
      target="_blank"
      className="text-ink-muted hover:text-ink flex items-center gap-1.5 text-[12px]"
    >
      Open on GitHub
      <span className="sr-only">{` (${what})`}</span>
      <ArrowRight aria-hidden="true" className="size-3" />
    </a>
  );
}

/**
 * A pull request or issue number that is itself the link to GitHub, as Daniel
 * asked on the prototypes, so the rest of the row is free to toggle.
 */
export function GitHubNumberLink({
  href,
  number,
  kind,
}: {
  href: string;
  number: number;
  kind: "pull request" | "issue";
}) {
  const tone =
    kind === "issue"
      ? "text-issue-strong hover:bg-issue-wash"
      : "text-pr-strong hover:bg-pr-wash";
  return (
    <a
      href={href}
      rel="noreferrer noopener"
      target="_blank"
      title={`Open ${kind} #${number} on GitHub`}
      className={`decoration-hairline focus-visible:outline-pr inline-flex items-center gap-0.5 justify-self-start rounded-md px-1.5 py-1 font-mono text-[12.5px] underline underline-offset-[3px] hover:decoration-current focus-visible:outline-2 ${tone}`}
    >
      <span className="sr-only">{`Open ${kind} `}</span>#{number}
      <span className="sr-only"> on GitHub</span>
      <ArrowUpRight aria-hidden="true" className="size-[11px]" />
    </a>
  );
}
