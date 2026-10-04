import { and, arrayContains, asc, eq, inArray, sql } from "drizzle-orm";

import {
  isLabelColour,
  Label,
  labelExists,
  LabelRenamed,
  type LabelRepository,
  type TaskError,
} from "@/modules/tasks/domain";
import { err, ok, UniqueId, type Result } from "@/shared/domain";
import type { Database } from "@/shared/infrastructure/database/client";

import { isUniqueViolation } from "./drizzle-skill.repository";
import {
  task as taskTable,
  taskLabel,
  taskSkill,
  taskSkillLabel,
} from "./persistence/schema";

type LabelRow = typeof taskLabel.$inferSelect;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * The label catalogue in Postgres. The unique index on owner and name is what
 * turns a second label of one name into `label-exists`, on create and on
 * rename alike.
 */
export class DrizzleLabelRepository implements LabelRepository {
  constructor(private readonly db: Database) {}

  async all(ownerId: string): Promise<Label[]> {
    const rows = await this.db
      .select()
      .from(taskLabel)
      .where(eq(taskLabel.ownerId, ownerId))
      .orderBy(asc(taskLabel.name));
    return rows.map(restore);
  }

  async findByName(ownerId: string, name: string): Promise<Label | undefined> {
    const [row] = await this.db
      .select()
      .from(taskLabel)
      .where(and(eq(taskLabel.ownerId, ownerId), eq(taskLabel.name, name)));
    return row ? restore(row) : undefined;
  }

  async inUse(ownerId: string, name: string): Promise<boolean> {
    const [onTask] = await this.db
      .select({ id: taskTable.id })
      .from(taskTable)
      .where(
        and(
          eq(taskTable.ownerId, ownerId),
          arrayContains(taskTable.labels, [name]),
        ),
      )
      .limit(1);
    if (onTask) return true;
    const [onSkill] = await this.db
      .select({ id: taskSkillLabel.skillId })
      .from(taskSkillLabel)
      .where(
        and(
          eq(taskSkillLabel.ownerId, ownerId),
          eq(taskSkillLabel.labelName, name),
        ),
      )
      .limit(1);
    return onSkill !== undefined;
  }

  async update(label: Label): Promise<Result<void, TaskError>> {
    const renames = label.domainEvents.filter(
      (event): event is LabelRenamed => event instanceof LabelRenamed,
    );
    try {
      await this.db.transaction(async (tx) => {
        await tx
          .update(taskLabel)
          .set({ name: label.name, colour: label.colour })
          .where(
            and(
              eq(taskLabel.ownerId, label.ownerId),
              eq(taskLabel.id, label.id.value),
            ),
          );
        for (const rename of renames) {
          await renameEverywhere(tx, label.ownerId, rename.from, rename.to);
        }
      });
    } catch (error) {
      if (isUniqueViolation(error)) return err(labelExists(label.name));
      throw error;
    }
    label.pullDomainEvents();
    return ok(undefined);
  }

  async save(label: Label): Promise<Result<void, TaskError>> {
    const [saved] = await this.db
      .insert(taskLabel)
      .values({
        id: label.id.value,
        ownerId: label.ownerId,
        name: label.name,
        colour: label.colour,
        createdAt: label.createdAt,
      })
      .onConflictDoNothing()
      .returning({ id: taskLabel.id });
    if (!saved) return err(labelExists(label.name));
    label.pullDomainEvents();
    return ok(undefined);
  }
}

function restore(row: LabelRow): Label {
  return Label.restore(UniqueId.create(row.id), {
    ownerId: row.ownerId,
    name: row.name,
    colour: isLabelColour(row.colour) ? row.colour : "gray",
    createdAt: row.createdAt,
  });
}

/**
 * Carry a rename to every task and skill holding the old name. A task or
 * skill that already holds the new name too keeps it once. Both bump their
 * version, so a copy loaded before the rename cannot save the old name back.
 */
async function renameEverywhere(
  tx: Transaction,
  ownerId: string,
  from: string,
  to: string,
): Promise<void> {
  await tx
    .update(taskTable)
    .set({
      labels: sql`array(
        select l from unnest(array_replace(${taskTable.labels}, ${from}, ${to}))
          with ordinality as t(l, i)
        group by l order by min(i)
      )`,
      version: sql`${taskTable.version} + 1`,
    })
    .where(
      and(
        eq(taskTable.ownerId, ownerId),
        arrayContains(taskTable.labels, [from]),
      ),
    );

  const linked = await tx
    .select({ skillId: taskSkillLabel.skillId })
    .from(taskSkillLabel)
    .where(
      and(
        eq(taskSkillLabel.ownerId, ownerId),
        eq(taskSkillLabel.labelName, from),
      ),
    );
  if (linked.length === 0) return;
  const skillIds = linked.map((row) => row.skillId);
  await tx
    .delete(taskSkillLabel)
    .where(
      and(
        inArray(taskSkillLabel.skillId, skillIds),
        eq(taskSkillLabel.labelName, from),
      ),
    );
  await tx
    .insert(taskSkillLabel)
    .values(skillIds.map((skillId) => ({ skillId, ownerId, labelName: to })))
    .onConflictDoNothing();
  await tx
    .update(taskSkill)
    .set({ version: sql`${taskSkill.version} + 1` })
    .where(inArray(taskSkill.id, skillIds));
}
