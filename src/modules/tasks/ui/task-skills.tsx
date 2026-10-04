import { BookOpenText } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import type { BriefSkill } from "@/modules/tasks/application/queries/read-models";

import { LabelChips, type LabelOption } from "./labels";
import { skillHref, SKILLS_PATH } from "./skill-views";

/**
 * The skills a task's labels bring, read-only: an agent that starts the task
 * gets these in full. Changing them happens in Skills & labels, which each
 * name links to.
 */
export function TaskSkills({
  skills,
  labels,
}: {
  skills: readonly BriefSkill[];
  labels: readonly LabelOption[];
}) {
  return (
    <section aria-labelledby="task-skills" className="flex flex-col gap-2">
      <h2
        id="task-skills"
        className="text-ink flex items-baseline gap-2 text-[13px] font-semibold"
      >
        Skills
        {skills.length > 0 ? (
          <span className="text-ink-faint font-mono text-[11.5px] font-normal">
            {skills.length}
          </span>
        ) : null}
      </h2>
      {skills.length === 0 ? (
        <p className="text-ink-muted text-[12.5px]">
          No skills. Link one to a label in{" "}
          <Link
            href={SKILLS_PATH}
            className="hover:text-ink underline underline-offset-2"
          >
            Skills &amp; labels
          </Link>
          .
        </p>
      ) : (
        <>
          <p className="text-ink-muted text-[12px]">
            An agent that starts this task follows these.
          </p>
          <ul className="m-0 flex list-none flex-col p-0">
            {skills.map((skill) => (
              <li
                key={skill.name}
                className="border-hairline-soft flex items-start gap-2 border-t py-2"
              >
                <BookOpenText
                  aria-hidden="true"
                  className="text-ink-muted mt-0.5 size-[15px] shrink-0"
                />
                <div className="flex min-w-0 flex-col gap-1">
                  <Link
                    href={skillHref(skill.name)}
                    title={skill.description}
                    className="text-pr truncate font-mono text-[12.5px] font-medium hover:underline"
                  >
                    {skill.name}
                  </Link>
                  <span className="text-ink-muted flex flex-wrap items-center gap-1 text-[12px]">
                    from <LabelChips names={skill.via} catalogue={labels} />
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** The same, as one line in the task dialog's side column. */
export function TaskSkillsLine({ skills }: { skills: readonly BriefSkill[] }) {
  if (skills.length === 0) return null;
  return (
    <div className="border-hairline-soft flex flex-col gap-1.5 border-t pt-3">
      <span className="text-ink-muted text-[12px]">Skills</span>
      <span className="flex flex-wrap gap-x-3 gap-y-1">
        {skills.map((skill) => (
          <Link
            key={skill.name}
            href={skillHref(skill.name)}
            title={skill.description}
            className="text-pr font-mono text-[12.5px] hover:underline"
          >
            {skill.name}
          </Link>
        ))}
      </span>
    </div>
  );
}
