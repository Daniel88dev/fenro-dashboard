import { and, eq, inArray } from "drizzle-orm";

import {
  isLabelColour,
  Label,
  labelExists,
  type LabelRepository,
  type TaskError,
} from "@/modules/tasks/domain";
import { err, ok, UniqueId, type Result } from "@/shared/domain";
import type { Database } from "@/shared/infrastructure/database/client";

import { taskLabel } from "./persistence/schema";

/**
 * The label catalogue in Postgres. A label is only ever added, so a save is
 * an insert, and the unique index on owner and name is what turns a second
 * label of one name into `label-exists`.
 */
export class DrizzleLabelRepository implements LabelRepository {
  constructor(private readonly db: Database) {}

  async named(ownerId: string, names: readonly string[]): Promise<Label[]> {
    if (names.length === 0) return [];
    const rows = await this.db
      .select()
      .from(taskLabel)
      .where(
        and(
          eq(taskLabel.ownerId, ownerId),
          inArray(taskLabel.name, [...names]),
        ),
      );
    return rows.map((row) =>
      Label.restore(UniqueId.create(row.id), {
        ownerId: row.ownerId,
        name: row.name,
        colour: isLabelColour(row.colour) ? row.colour : "gray",
        createdAt: row.createdAt,
      }),
    );
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
