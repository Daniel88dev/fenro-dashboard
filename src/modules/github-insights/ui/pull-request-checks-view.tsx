import {
  CheckCircle,
  CircleDashed,
  MinusCircle,
  Plus,
  XCircle,
} from "@phosphor-icons/react/ssr";
import type { Icon } from "@phosphor-icons/react";
import Link from "next/link";

import type {
  CheckConclusion,
  PullRequestChecks,
} from "@/modules/github-insights/application/queries/read-models";

import { CHECKS_INDENT } from "./panel";
import { conclusionClass } from "./tones";

const CONCLUSIONS: Record<CheckConclusion, { word: string; icon: Icon }> = {
  passed: { word: "passed", icon: CheckCircle },
  failed: { word: "failed", icon: XCircle },
  running: { word: "running", icon: CircleDashed },
  skipped: { word: "skipped", icon: MinusCircle },
};

/** The checks behind a pull request, and a sentence saying what blocks it. */
export function PullRequestChecksView({
  id,
  checks,
  newTaskHref,
}: {
  id: string;
  checks: PullRequestChecks;
  /** Where "Make a task from this" goes; the route decides, not this context. */
  newTaskHref?: string;
}) {
  return (
    <div
      id={id}
      className={`bg-surface-raised border-hairline-soft flex flex-col border-t pt-1 ${CHECKS_INDENT}`}
    >
      <div className="flex items-baseline justify-between pt-2.5 pb-1">
        <h4 className="text-ink text-[13px] font-semibold">Checks</h4>
        <span className="text-ink-faint font-mono text-[12px]">
          {checks.headSha}
        </span>
      </div>

      <ul className="m-0 flex list-none flex-col p-0">
        {checks.checks.map((check) => {
          const { word, icon: ConclusionIcon } = CONCLUSIONS[check.conclusion];
          const tone = conclusionClass(check.conclusion);
          return (
            <li
              key={check.name}
              className="border-hairline-soft grid grid-cols-[18px_minmax(0,1fr)_auto_64px] items-center gap-x-2.5 border-b py-2 text-[12.5px]"
            >
              <ConclusionIcon aria-hidden="true" className={`size-4 ${tone}`} />
              <span className="text-ink truncate font-mono">{check.name}</span>
              <span className="text-ink-faint text-right font-mono">
                {check.duration ?? ""}
              </span>
              <span className={`text-right ${tone}`}>{word}</span>
            </li>
          );
        })}
      </ul>

      <p className="text-ink-soft pt-3 text-[12.5px]">
        {checks.blockingReason}
      </p>

      {newTaskHref ? (
        <div className="flex items-center gap-2.5 pt-3">
          <Link
            href={newTaskHref}
            scroll={false}
            className="border-hairline bg-surface text-ink hover:bg-surface-sunken focus-visible:outline-pr flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium focus-visible:outline-2"
          >
            <Plus aria-hidden="true" weight="bold" className="size-[13px]" />
            Make a task from this
          </Link>
        </div>
      ) : null}
    </div>
  );
}
