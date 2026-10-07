import Link from "next/link";

import type {
  LabelItem,
  SkillDetail,
  SkillItem,
} from "@/modules/tasks/application/queries/read-models";

import { LabelEditor, NewLabelForm } from "./label-editor";
import { SkillEditor } from "./skill-editor";
import { LabelList, SkillList } from "./skill-list";
import { SKILLS_PATH, type SkillActions } from "./skill-views";

export type SkillsTab = "skills" | "labels";

/**
 * Skills & labels: a tab for each, each a searchable list beside the one item
 * open in it. Which tab and which item are in the address, so a reload or a
 * shared link opens the same thing.
 */
export function SkillsScreen({
  tab,
  skills,
  labels,
  skill,
  label,
  actions,
  now,
}: {
  tab: SkillsTab;
  skills: readonly SkillItem[];
  labels: readonly LabelItem[];
  /** The skill in the editor: null for a new one, undefined for none. */
  skill: SkillDetail | null | undefined;
  /** The label beside the list, if any. */
  label: LabelItem | undefined;
  actions: SkillActions;
  now: Date;
}) {
  const tabs = [
    { tab: "skills", label: "Skills", href: SKILLS_PATH, count: skills.length },
    {
      tab: "labels",
      label: "Labels",
      href: `${SKILLS_PATH}?tab=labels`,
      count: labels.length,
    },
  ] as const;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-ink text-[24px] leading-tight font-semibold tracking-tight">
          Skills &amp; labels
        </h1>
        <p className="text-ink-muted max-w-[72ch] text-[13px]">
          A skill is a set of instructions. Link it to labels, and every agent
          that starts a task with one of those labels gets it in full.
        </p>
      </header>

      <nav
        aria-label="Skills and labels"
        className="border-hairline -mb-px flex gap-1 border-b"
      >
        {tabs.map((item) => {
          const here = item.tab === tab;
          return (
            <Link
              key={item.tab}
              href={item.href}
              aria-current={here ? "page" : undefined}
              className={`focus-visible:outline-pr -mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 pt-1.5 pb-2.5 text-[13px] whitespace-nowrap focus-visible:outline-2 ${
                here
                  ? "border-ink text-ink font-medium"
                  : "text-ink-muted hover:text-ink border-transparent"
              }`}
            >
              {item.label}
              <span className="text-ink-faint font-mono text-[12px]">
                {item.count}
              </span>
            </Link>
          );
        })}
      </nav>

      {tab === "skills" ? (
        <div className="flex flex-col items-start gap-[18px] lg:flex-row">
          <SkillList
            skills={skills}
            labels={labels}
            selected={skill?.name ?? null}
          />
          <div className="w-full min-w-0 flex-1">
            {skill === undefined ? (
              <Placeholder>
                {skills.length === 0
                  ? "Write a skill, then link it to the labels whose tasks should follow it."
                  : "Pick a skill to read or change it."}
              </Placeholder>
            ) : (
              <SkillEditor
                key={skill ? `${skill.id}@${skill.revision}` : "new"}
                skill={skill}
                catalogue={labels}
                actions={actions}
                now={now}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-[18px] lg:flex-row">
          <LabelList
            labels={labels}
            selected={label?.name ?? null}
            create={<NewLabelForm create={actions.createLabel} />}
          />
          <div className="w-full min-w-0 flex-1">
            {label ? (
              <LabelEditor
                key={label.name}
                label={label}
                skills={skills}
                actions={actions}
              />
            ) : (
              <Placeholder>
                Pick a label to rename, recolour or link it.
              </Placeholder>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Placeholder({ children }: { children: string }) {
  return (
    <p className="border-hairline text-ink-muted rounded-xl border border-dashed px-5 py-10 text-center text-[13px]">
      {children}
    </p>
  );
}
