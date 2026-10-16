import {
  pictureNotFound,
  type PictureType,
  type TaskError,
} from "@/modules/tasks/domain";
import type { Query, QueryHandler } from "@/shared/application";
import { err, ok, type Result } from "@/shared/domain";

import type { PictureStorage } from "../ports/picture-storage";
import type { TaskReadStore } from "../ports/task-read-store";

export type PictureContent = {
  readonly name: string;
  readonly type: PictureType;
  readonly bytes: Uint8Array;
};

export type PictureContentResult = Result<PictureContent, TaskError>;

export type PictureContentQuery = Query<
  "tasks.picture-content",
  PictureContentResult
> & {
  readonly ownerId: string;
  readonly picture: string;
};

export function pictureContentQuery(
  ownerId: string,
  picture: string,
): PictureContentQuery {
  return { type: "tasks.picture-content", ownerId, picture };
}

export class PictureContentHandler implements QueryHandler<
  PictureContentQuery,
  PictureContentResult
> {
  constructor(
    private readonly tasks: TaskReadStore,
    private readonly storage: PictureStorage,
  ) {}

  async handle(query: PictureContentQuery): Promise<PictureContentResult> {
    const record = await this.tasks.picture(query.ownerId, query.picture);
    if (!record) return err(pictureNotFound(query.picture));
    const bytes = await this.storage.read(record.storageKey);
    if (!bytes) return err(pictureNotFound(query.picture));
    return ok({ name: record.name, type: record.type, bytes });
  }
}
