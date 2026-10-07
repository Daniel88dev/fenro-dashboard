import type { TaskAction } from "./task-forms";

/** Every server action the Skills & labels screen uses, handed down by the route. */
export type SkillActions = {
  /** Create a skill, or revise the one named by the `skill` field. */
  readonly save: TaskAction;
  readonly restore: TaskAction;
  /** Delete the skill named by the `skill` field. People only: agents can't. */
  readonly remove: TaskAction;
  readonly link: TaskAction;
  readonly unlink: TaskAction;
  readonly createLabel: TaskAction;
  readonly renameLabel: TaskAction;
  readonly recolourLabel: TaskAction;
};

export const SKILLS_PATH = "/skills";

export const NEW_SKILL = "new";

export function skillHref(name: string): string {
  return `${SKILLS_PATH}?skill=${encodeURIComponent(name)}`;
}

export function labelHref(name: string): string {
  return `${SKILLS_PATH}?tab=labels&label=${encodeURIComponent(name)}`;
}

/** "who" as the history and the editor's header say it. */
export function changedBy(name: string, kind: "agent" | "human"): string {
  return kind === "agent" ? `${name} (agent)` : name;
}
