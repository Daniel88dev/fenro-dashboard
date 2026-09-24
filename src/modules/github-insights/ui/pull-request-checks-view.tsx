import type { PullRequestChecks } from "@/modules/github-insights/application/queries/read-models";

import { conclusionClass } from "./tones";

const CONCLUSION_WORDS = {
  passed: "passed",
  failed: "failed",
  running: "running",
  skipped: "skipped",
} as const;

/** The checks behind a pull request, and a sentence saying what blocks it. */
export function PullRequestChecksView({
  id,
  checks,
  pullRequestUrl,
  number,
  newTaskHref,
}: {
  id: string;
  checks: PullRequestChecks;
  pullRequestUrl: string;
  number: number;
  /** Where "Make a task from this" goes; the route decides, not this context. */
  newTaskHref?: string;
}) {
  return (
    <div id={id} className="flex flex-col gap-0.5 pt-0.5 pr-3 pb-3 pl-[67px]">
      <div className="flex items-baseline justify-between pt-1.5 pb-1">
        <h4 className="text-ink text-[12px] font-medium">Checks</h4>
        <span className="text-ink-faint font-mono text-[11.5px]">
          {checks.headSha}
        </span>
      </div>

      <ul className="flex flex-col">
        {checks.checks.map((check) => (
          <li
            key={check.name}
            className="border-surface-sunken flex items-center gap-[11px] border-b py-[7px] last:border-b-0"
          >
            <span className="text-ink flex-1 font-mono text-[12px]">
              {check.name}
            </span>
            <span className="text-ink-faint font-mono text-[11.5px]">
              {check.duration ?? "—"}
            </span>
            <span
              className={`w-[68px] text-right text-[11.5px] ${conclusionClass(check.conclusion)}`}
            >
              {CONCLUSION_WORDS[check.conclusion]}
            </span>
          </li>
        ))}
      </ul>

      <p className="text-ink-muted pt-2.5 text-[12px]">
        {checks.blockingReason}
      </p>

      <div className="flex items-center gap-2.5 pt-2.5">
        {newTaskHref ? (
          <a
            href={newTaskHref}
            className="border-ink bg-ink text-ground hover:bg-ink-soft rounded-lg border px-[11px] py-1.5 text-[12px] font-medium"
          >
            Make a task from this
          </a>
        ) : null}
        <a
          href={pullRequestUrl}
          rel="noreferrer noopener"
          target="_blank"
          className="border-hairline text-ink hover:bg-surface-sunken rounded-lg border px-[11px] py-1.5 text-[12px] font-medium"
        >
          Open
          <span className="sr-only">{` pull request ${number}`}</span> on GitHub
        </a>
      </div>
    </div>
  );
}
