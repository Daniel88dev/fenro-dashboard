import type { TaskAction } from "./task-forms";

export type SkillActions = {
  readonly save: TaskAction;
  readonly restore: TaskAction;
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

export function changedBy(name: string, kind: "agent" | "human"): string {
  return kind === "agent" ? `${name} (agent)` : name;
}
