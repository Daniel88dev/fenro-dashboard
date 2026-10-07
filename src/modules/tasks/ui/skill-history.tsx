"use client";

import { useState } from "react";

import { formatRelativeTime } from "@/modules/github-insights/ui/format";
import type {
  SkillDetail,
  SkillRevisionItem,
} from "@/modules/tasks/application/queries/read-models";

import { changedBy } from "./skill-views";
import { ButtonForm, type TaskAction } from "./task-forms";

/**
 * What one revision changed against the one before it, in words. The oldest
 * one shown has nothing before it on screen: it says "Created" only when it
 * really is the first.
 */
export function revisionChange(
  revision: SkillRevisionItem,
  before: SkillRevisionItem | undefined,
): string {
  if (!before) return revision.revision === 1 ? "Created" : "Changed";
  const fields = [
    revision.name !== before.name ? "the name" : null,
    revision.description !== before.description ? "the description" : null,
    revision.instructions !== before.instructions ? "the instructions" : null,
  ].filter((field): field is string => field !== null);
  if (fields.length === 0) return "Restored";
  const last = fields.pop();
  return `Changed ${fields.length ? `${fields.join(", ")} and ${last}` : last}`;
}

/**
 * Every revision kept for the skill, newest first, each but the current one
 * with Restore. Restoring asks once, then puts that text back as a new
 * revision, so nothing is lost either way.
 */
export function SkillHistory({
  skill,
  restore,
  now,
}: {
  skill: SkillDetail;
  restore: TaskAction;
  now: Date;
}) {
  const [confirming, setConfirming] = useState<number | null>(null);
  const revisions = skill.revisions;

  return (
    <aside
      aria-label="History"
      className="border-hairline bg-surface-raised flex flex-col border-t px-4 py-3.5 lg:w-[280px] lg:shrink-0 lg:rounded-br-xl lg:border-t-0 lg:border-l"
    >
      <h2 className="text-ink mb-1.5 text-[13px] font-semibold">History</h2>
      <ol className="m-0 flex list-none flex-col p-0">
        {revisions.map((revision, index) => {
          const current = revision.revision === skill.revision;
          return (
            <li
              key={revision.revision}
              className="border-hairline-soft flex flex-col gap-0.5 border-t py-2.5"
            >
              <div className="flex items-center gap-2">
                <span className="text-ink font-mono text-[12px] font-medium">
                  rev {revision.revision}
                </span>
                <span className="text-ink-muted flex-1 text-[12px]">
                  {formatRelativeTime(new Date(revision.at), now)}
                </span>
                {current ? (
                  <span className="text-ink-faint text-[11.5px]">Current</span>
                ) : (
                  <button
                    type="button"
                    aria-expanded={confirming === revision.revision}
                    onClick={() =>
                      setConfirming((was) =>
                        was === revision.revision ? null : revision.revision,
                      )
                    }
                    className="text-pr hover:bg-surface-sunken focus-visible:outline-pr h-6 cursor-pointer rounded-md px-1.5 text-[12px] font-medium focus-visible:outline-2"
                  >
                    Restore
                  </button>
                )}
              </div>
              <span className="text-ink-soft font-mono text-[12px]">
                {changedBy(revision.by, revision.byKind)}
              </span>
              <span className="text-ink-muted text-[12px]">
                {revisionChange(revision, revisions[index + 1])}
              </span>
              {confirming === revision.revision ? (
                <div className="border-hairline bg-surface mt-1.5 flex flex-col gap-2 rounded-lg border p-2.5">
                  <p className="text-ink text-[12px]">
                    Puts the text of rev {revision.revision} back as a new
                    revision. Nothing is lost.
                  </p>
                  <div className="flex flex-wrap items-start gap-1.5">
                    <ButtonForm
                      action={restore}
                      task=""
                      label={`Restore rev ${revision.revision}`}
                      values={{
                        skill: skill.id,
                        revision: String(revision.revision),
                        expectedRevision: String(skill.revision),
                      }}
                      tone="quiet"
                    >
                      Restore rev {revision.revision}
                    </ButtonForm>
                    <button
                      type="button"
                      onClick={() => setConfirming(null)}
                      className="text-ink-muted hover:text-ink focus-visible:outline-pr h-[30px] cursor-pointer rounded-lg px-2 text-[12px] focus-visible:outline-2"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
