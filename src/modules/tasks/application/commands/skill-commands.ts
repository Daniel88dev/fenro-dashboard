import {
  normaliseSkillName,
  skillNotFound,
  taskError,
  type Skill,
  type SkillRepository,
  type TaskError,
} from "@/modules/tasks/domain";
import { err, ok, type Result } from "@/shared/domain";

export type SkillReference = string;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function skillLookup(
  reference: SkillReference,
): { readonly id: string } | { readonly name: string } {
  const trimmed = reference.trim();
  return UUID.test(trimmed)
    ? { id: trimmed.toLowerCase() }
    : { name: normaliseSkillName(trimmed) };
}

export async function findSkill(
  skills: SkillRepository,
  ownerId: string,
  reference: SkillReference,
): Promise<Result<Skill, TaskError>> {
  const lookup = skillLookup(reference);
  const skill =
    "id" in lookup
      ? await skills.findById(ownerId, lookup.id)
      : await skills.findByName(ownerId, lookup.name);
  return skill ? ok(skill) : err(skillNotFound(reference.trim()));
}

const ATTEMPTS = 3;

/**
 * Retrying is safe for a revise: it still checks the revision its editor
 * read against the fresh copy.
 */
export async function changeSkill(
  skills: SkillRepository,
  ownerId: string,
  reference: SkillReference,
  change: (
    skill: Skill,
  ) => Promise<Result<void, TaskError>> | Result<void, TaskError>,
): Promise<Result<void, TaskError>> {
  let last: TaskError = taskError(
    "concurrent-modification",
    `Skill "${reference}" kept changing while this was being saved. Try again.`,
  );
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const found = await findSkill(skills, ownerId, reference);
    if (!found.ok) return found;

    const changed = await change(found.value);
    if (!changed.ok) return changed;

    const saved = await skills.save(found.value);
    if (saved.ok || saved.error.code !== "concurrent-modification") {
      return saved;
    }
    last = saved.error;
  }
  return err(last);
}
