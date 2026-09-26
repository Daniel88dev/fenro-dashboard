import {
  pictureNotFound,
  type PictureType,
  type TaskError,
} from "@/modules/tasks/domain";
import type { Query, QueryHandler } from "@/shared/application";
import { err, ok, type Result } from "@/shared/domain";

import type { PictureStorage } from "../ports/picture-storage";
import type { TaskReadStore } from "../ports/task-read-store";

export type PictureLink = {
  readonly name: string;
  readonly type: PictureType;
  /** Short-lived: fetch a new one rather than keeping it. */
  readonly url: string;
};

export type PictureLinkResult = Result<PictureLink, TaskError>;

/** Where a browser can load one of the owner's pictures from, right now. */
export type PictureLinkQuery = Query<
  "tasks.picture-link",
  PictureLinkResult
> & {
  readonly ownerId: string;
  readonly picture: string;
};

export function pictureLinkQuery(
  ownerId: string,
  picture: string,
): PictureLinkQuery {
  return { type: "tasks.picture-link", ownerId, picture };
}

export class PictureLinkHandler implements QueryHandler<
  PictureLinkQuery,
  PictureLinkResult
> {
  constructor(
    private readonly tasks: TaskReadStore,
    private readonly storage: PictureStorage,
  ) {}

  async handle(query: PictureLinkQuery): Promise<PictureLinkResult> {
    const record = await this.tasks.picture(query.ownerId, query.picture);
    if (!record) return err(pictureNotFound(query.picture));
    return ok({
      name: record.name,
      type: record.type,
      url: await this.storage.link(record.storageKey),
    });
  }
}

export type PictureContent = {
  readonly name: string;
  readonly type: PictureType;
  readonly bytes: Uint8Array;
};

export type PictureContentResult = Result<PictureContent, TaskError>;

/** A picture's bytes, for an agent to look at. */
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
