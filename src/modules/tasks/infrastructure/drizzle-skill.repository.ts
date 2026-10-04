import { and, asc, eq } from "drizzle-orm";

import {
  Skill,
  skillExists,
  taskError,
  type Actor,
  type SkillRepository,
  type SkillRevision,
  type TaskError,
} from "@/modules/tasks/domain";
import { err, ok, UniqueId, type Result } from "@/shared/domain";
import type { Database } from "@/shared/infrastructure/database/client";

import {
  taskSkill,
  taskSkillLabel,
  taskSkillRevision,
} from "./persistence/schema";

type SkillRow = typeof taskSkill.$inferSelect;

const UNIQUE_VIOLATION = "23505";

/**
 * `Skill` in Postgres, with the same optimistic concurrency as tasks: the
 * version a skill was loaded at is remembered beside it, and a save only lands
 * if the row still has it. Revisions are appended, never rewritten; links are
 * replaced whole on each save.
 */
export class DrizzleSkillRepository implements SkillRepository {
  readonly #loadedVersions = new WeakMap<Skill, number>();

  constructor(private readonly db: Database) {}

  async findById(ownerId: string, id: string): Promise<Skill | undefined> {
    const [row] = await this.db
      .select()
      .from(taskSkill)
      .where(and(eq(taskSkill.ownerId, ownerId), eq(taskSkill.id, id)));
    return row ? this.#restore(row) : undefined;
  }

  async findByName(ownerId: string, name: string): Promise<Skill | undefined> {
    const [row] = await this.db
      .select()
      .from(taskSkill)
      .where(and(eq(taskSkill.ownerId, ownerId), eq(taskSkill.name, name)));
    return row ? this.#restore(row) : undefined;
  }

  async revision(
    ownerId: string,
    skillId: string,
    revision: number,
  ): Promise<SkillRevision | undefined> {
    const [row] = await this.db
      .select({ revision: taskSkillRevision })
      .from(taskSkillRevision)
      .innerJoin(taskSkill, eq(taskSkill.id, taskSkillRevision.skillId))
      .where(
        and(
          eq(taskSkill.ownerId, ownerId),
          eq(taskSkillRevision.skillId, skillId),
          eq(taskSkillRevision.revision, revision),
        ),
      );
    if (!row) return undefined;
    const kept = row.revision;
    return {
      revision: kept.revision,
      name: kept.name,
      description: kept.description,
      instructions: kept.instructions,
      by: actor(kept.byKind, kept.byId, kept.byName),
      at: kept.at,
    };
  }

  async save(skill: Skill): Promise<Result<void, TaskError>> {
    const loaded = this.#loadedVersions.get(skill);
    const { state } = skill;
    const id = skill.id.value;
    const values = {
      id,
      ownerId: skill.ownerId,
      name: state.name,
      description: state.description,
      instructions: state.instructions,
      revision: state.revision,
      createdByKind: state.createdBy.kind,
      createdById: state.createdBy.id,
      createdByName: state.createdBy.name,
      updatedByKind: state.updatedBy.kind,
      updatedById: state.updatedBy.id,
      updatedByName: state.updatedBy.name,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
    };

    let version: number | undefined;
    try {
      version = await this.db.transaction(async (tx) => {
        const [saved] =
          loaded === undefined
            ? await tx
                .insert(taskSkill)
                .values({ ...values, version: 1 })
                .onConflictDoNothing({ target: taskSkill.id })
                .returning({ version: taskSkill.version })
            : await tx
                .update(taskSkill)
                .set({ ...values, version: loaded + 1 })
                .where(and(eq(taskSkill.id, id), eq(taskSkill.version, loaded)))
                .returning({ version: taskSkill.version });
        if (!saved) return undefined;

        await tx.delete(taskSkillLabel).where(eq(taskSkillLabel.skillId, id));
        if (state.labels.length > 0) {
          await tx.insert(taskSkillLabel).values(
            state.labels.map((labelName) => ({
              skillId: id,
              ownerId: skill.ownerId,
              labelName,
            })),
          );
        }
        // Drained only once the transaction is sure to commit them.
        const revisions = skill.pullNewRevisions();
        if (revisions.length > 0) {
          await tx.insert(taskSkillRevision).values(
            revisions.map((revision) => ({
              skillId: id,
              revision: revision.revision,
              name: revision.name,
              description: revision.description,
              instructions: revision.instructions,
              byKind: revision.by.kind,
              byId: revision.by.id,
              byName: revision.by.name,
              at: revision.at,
            })),
          );
        }
        return saved.version;
      });
    } catch (error) {
      if (isUniqueViolation(error)) return err(skillExists(state.name));
      throw error;
    }

    if (version === undefined) {
      return err(
        taskError(
          "concurrent-modification",
          `Skill "${state.name}" changed while this was being saved. Read it again and retry.`,
        ),
      );
    }
    this.#loadedVersions.set(skill, version);
    skill.pullDomainEvents();
    return ok(undefined);
  }

  async remove(skill: Skill): Promise<void> {
    await this.db
      .delete(taskSkill)
      .where(
        and(
          eq(taskSkill.ownerId, skill.ownerId),
          eq(taskSkill.id, skill.id.value),
        ),
      );
    skill.pullDomainEvents();
  }

  async #restore(row: SkillRow): Promise<Skill> {
    const labels = await this.db
      .select({ name: taskSkillLabel.labelName })
      .from(taskSkillLabel)
      .where(eq(taskSkillLabel.skillId, row.id))
      .orderBy(asc(taskSkillLabel.labelName));
    const skill = Skill.restore(UniqueId.create(row.id), row.ownerId, {
      name: row.name,
      description: row.description,
      instructions: row.instructions,
      labels: labels.map((label) => label.name),
      revision: row.revision,
      createdBy: actor(row.createdByKind, row.createdById, row.createdByName),
      createdAt: row.createdAt,
      updatedBy: actor(row.updatedByKind, row.updatedById, row.updatedByName),
      updatedAt: row.updatedAt,
    });
    this.#loadedVersions.set(skill, row.version);
    return skill;
  }
}

function actor(kind: string, id: string, name: string): Actor {
  return { kind: kind === "agent" ? "agent" : "human", id, name };
}

/** Postgres's unique violation, as node-postgres or Drizzle's wrapper has it. */
export function isUniqueViolation(error: unknown): boolean {
  for (
    let current: unknown = error;
    current && typeof current === "object";
    current = (current as { cause?: unknown }).cause
  ) {
    if ((current as { code?: unknown }).code === UNIQUE_VIOLATION) return true;
  }
  return false;
}
