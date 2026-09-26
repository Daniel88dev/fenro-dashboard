import {
  pictureNotFound,
  type PictureRepository,
  type TaskError,
} from "@/modules/tasks/domain";
import type { CommandHandler } from "@/shared/application";
import { err, ok, type Result } from "@/shared/domain";

import type { PictureStorage } from "../ports/picture-storage";
import type { TaskCommand } from "./task-commands";

/** Take a picture off its task, and out of storage. */
export type RemovePictureCommand = TaskCommand<"tasks.remove-picture"> & {
  readonly picture: string;
};

export class RemovePictureHandler implements CommandHandler<RemovePictureCommand> {
  constructor(
    private readonly pictures: PictureRepository,
    private readonly storage: PictureStorage,
    private readonly clock: () => Date,
  ) {}

  async handle(
    command: RemovePictureCommand,
  ): Promise<Result<void, TaskError>> {
    const picture = await this.pictures.pictureById(
      command.ownerId,
      command.picture,
    );
    if (!picture) return err(pictureNotFound(command.picture));

    picture.remove(this.clock());
    await this.pictures.remove(picture);
    picture.pullDomainEvents();
    // The record is what the task shows; bytes left behind by a failed
    // delete are unreachable, so they are not worth failing over.
    await this.storage.remove(picture.storageKey).catch(() => undefined);
    return ok(undefined);
  }
}
