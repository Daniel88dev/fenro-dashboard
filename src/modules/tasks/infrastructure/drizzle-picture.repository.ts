import { and, eq } from "drizzle-orm";

import {
  isPictureType,
  Picture,
  type PictureRepository,
} from "@/modules/tasks/domain";
import { UniqueId } from "@/shared/domain";
import type { Database } from "@/shared/infrastructure/database/client";

import { taskPicture } from "./persistence/schema";

/** Pictures' records in Postgres. A picture is added and removed, never changed. */
export class DrizzlePictureRepository implements PictureRepository {
  constructor(private readonly db: Database) {}

  async pictureById(ownerId: string, id: string): Promise<Picture | undefined> {
    const [row] = await this.db
      .select()
      .from(taskPicture)
      .where(and(eq(taskPicture.ownerId, ownerId), eq(taskPicture.id, id)));
    if (!row) return undefined;
    return Picture.restore(UniqueId.create(row.id), {
      ownerId: row.ownerId,
      taskId: row.taskId,
      name: row.name,
      type: isPictureType(row.type) ? row.type : "image/png",
      byteSize: row.byteSize,
      storageKey: row.storageKey,
      addedBy: {
        kind: row.addedByKind === "agent" ? "agent" : "human",
        id: row.addedById,
        name: row.addedByName,
      },
      sessionId: row.sessionId,
      addedAt: row.addedAt,
    });
  }

  async add(picture: Picture): Promise<void> {
    await this.db.insert(taskPicture).values({
      id: picture.id.value,
      ownerId: picture.ownerId,
      taskId: picture.taskId,
      name: picture.name,
      type: picture.type,
      byteSize: picture.byteSize,
      storageKey: picture.storageKey,
      addedByKind: picture.addedBy.kind,
      addedById: picture.addedBy.id,
      addedByName: picture.addedBy.name,
      sessionId: picture.sessionId,
      addedAt: picture.addedAt,
    });
  }

  async remove(picture: Picture): Promise<void> {
    await this.db
      .delete(taskPicture)
      .where(
        and(
          eq(taskPicture.ownerId, picture.ownerId),
          eq(taskPicture.id, picture.id.value),
        ),
      );
  }
}
