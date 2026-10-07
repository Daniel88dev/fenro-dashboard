import { Suspense } from "react";

import { DashboardChrome } from "@/modules/github-insights/ui/dashboard-chrome";
import { SignInPanel } from "@/modules/identity/ui/sign-in-panel";
import { listLabelsQuery } from "@/modules/tasks/application/queries/list-labels";
import { listSkillsQuery } from "@/modules/tasks/application/queries/list-skills";
import type { SkillDetail } from "@/modules/tasks/application/queries/read-models";
import { skillQuery } from "@/modules/tasks/application/queries/skill";
import { SkillsScreen } from "@/modules/tasks/ui/skills-screen";
import { NEW_SKILL, type SkillActions } from "@/modules/tasks/ui/skill-views";
import { TaskLoading } from "@/modules/tasks/ui/task-loading";

import { signInWithGitHubAction } from "../sign-in/actions";
import { SignedInAccount } from "../signed-in-account";
import { tasksContext } from "../tasks/signed-in-owner";
import {
  createLabelAction,
  deleteSkillAction,
  linkSkillAction,
  recolourLabelAction,
  renameLabelAction,
  restoreSkillAction,
  saveSkillAction,
  unlinkSkillAction,
} from "./actions";

export const metadata = {
  title: "Skills & labels · Fenro Dashboard",
  description: "Instructions agents follow, picked by a task's labels.",
};

const ACTIONS: SkillActions = {
  save: saveSkillAction,
  restore: restoreSkillAction,
  remove: deleteSkillAction,
  link: linkSkillAction,
  unlink: unlinkSkillAction,
  createLabel: createLabelAction,
  renameLabel: renameLabelAction,
  recolourLabel: recolourLabelAction,
};

export default function SkillsPage({ searchParams }: PageProps<"/skills">) {
  return (
    <DashboardChrome
      current="skills"
      account={
        <Suspense fallback={null}>
          <SignedInAccount />
        </Suspense>
      }
    >
      <Suspense fallback={<TaskLoading what="your skills and labels" />}>
        <Screen searchParams={searchParams} />
      </Suspense>
    </DashboardChrome>
  );
}

async function Screen({
  searchParams,
}: {
  searchParams: PageProps<"/skills">["searchParams"];
}) {
  const params = await searchParams;
  const one = (value: string | string[] | undefined) =>
    (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
  const tab = one(params.tab) === "labels" ? "labels" : "skills";
  const now = new Date();

  const { container, ownerId } = await tasksContext(now);
  if (!ownerId) {
    return (
      <SignInPanel
        heading="Sign in to see your skills and labels"
        action={signInWithGitHubAction}
      />
    );
  }

  const [skills, labels] = await Promise.all([
    container.queryBus.ask(listSkillsQuery(ownerId)),
    container.queryBus.ask(listLabelsQuery(ownerId)),
  ]);

  // With nothing picked, the first of the list is open, so the editor is
  // never an empty half of the screen while there is something to show.
  const wanted = one(params.skill);
  let skill: SkillDetail | null | undefined;
  if (tab === "skills") {
    if (wanted === NEW_SKILL) skill = null;
    else {
      const name = wanted || skills[0]?.name;
      const found = name
        ? await container.queryBus.ask(skillQuery(ownerId, name))
        : null;
      skill = found?.ok ? found.value : undefined;
    }
  }
  const labelName = one(params.label) || labels[0]?.name;
  const label = labels.find((item) => item.name === labelName);

  return (
    <SkillsScreen
      tab={tab}
      skills={skills}
      labels={labels}
      skill={skill}
      label={label}
      actions={ACTIONS}
      now={now}
    />
  );
}
