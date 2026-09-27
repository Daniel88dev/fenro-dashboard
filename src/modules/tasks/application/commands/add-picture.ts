import {
  Picture,
  PictureFile,
  sameActor,
  taskError,
  type PictureRepository,
  type TaskError,
  type TaskRepository,
} from "@/modules/tasks/domain";
import type { Command, CommandHandler } from "@/shared/application";
import { err, ok, type Result } from "@/shared/domain";

import type { PictureStorage } from "../ports/picture-storage";
import type { UploadTickets } from "../ports/upload-tickets";
import {
  findTask,
  type TaskCommand,
  type TaskReference,
} from "./task-commands";

/** Add a picture to a task: a screenshot, a design, a photo. */
export type AddPictureCommand = TaskCommand<"tasks.add-picture"> & {
  readonly pictureId: string;
  readonly task: TaskReference;
  readonly fileName: string;
  readonly bytes: Uint8Array;
};

export function picturesUnavailable(detail: string): TaskError {
  return taskError("pictures-unavailable", detail);
}

export const NOT_CONFIGURED = picturesUnavailable(
  "Pictures are not set up on this Fenro: it has no UPLOADTHING_TOKEN. The owner adds one to turn pictures on.",
);

export class AddPictureHandler implements CommandHandler<AddPictureCommand> {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly pictures: PictureRepository,
    private readonly storage: PictureStorage,
    private readonly clock: () => Date,
  ) {}

  async handle(command: AddPictureCommand): Promise<Result<void, TaskError>> {
    if (!this.storage.configured) return err(NOT_CONFIGURED);
    // The same picture sent twice (a retried upload) is added once.
    if (await this.pictures.pictureById(command.ownerId, command.pictureId)) {
      return ok(undefined);
    }

    const task = await findTask(this.tasks, command.ownerId, command.task);
    if (!task.ok) return task;
    const file = PictureFile.read(command.fileName, command.bytes);
    if (!file.ok) return file;

    let key: string;
    try {
      ({ key } = await this.storage.put(file.value));
    } catch {
      return err(
        picturesUnavailable(
          "The picture could not be stored just now. Nothing was added; try again.",
        ),
      );
    }

    const now = this.clock();
    const live = task.value.liveSession(now);
    const picture = Picture.add({
      id: command.pictureId,
      ownerId: command.ownerId,
      taskId: task.value.id.value,
      file: file.value,
      storageKey: key,
      addedBy: command.actor,
      sessionId: live && sameActor(live.actor, command.actor) ? live.id : null,
      now,
    });
    try {
      await this.pictures.add(picture);
    } catch (error) {
      // Stored bytes nothing points at would only take up the free tier.
      await this.storage.remove(key).catch(() => undefined);
      throw error;
    }
    picture.pullDomainEvents();
    return ok(undefined);
  }
}

/**
 * The bytes of a picture an agent was given an upload link for. Who is adding
 * it, to which task and under what name all come from the ticket, so the link
 * is all the request needs to carry.
 */
export type UploadPictureCommand = Command<
  "tasks.upload-picture",
  TaskError
> & {
  readonly ticket: string;
  readonly bytes: Uint8Array;
};

export class UploadPictureHandler implements CommandHandler<UploadPictureCommand> {
  constructor(
    private readonly tickets: UploadTickets,
    private readonly add: AddPictureHandler,
    private readonly clock: () => Date,
  ) {}

  async handle(
    command: UploadPictureCommand,
  ): Promise<Result<void, TaskError>> {
    const ticket = this.tickets.redeem(command.ticket, this.clock());
    if (!ticket) {
      return err(
        taskError(
          "invalid-upload-link",
          "This upload link has expired or is not valid. Call attach_picture again for a new one.",
        ),
      );
    }
    return this.add.handle({
      type: "tasks.add-picture",
      ownerId: ticket.ownerId,
      actor: ticket.actor,
      pictureId: ticket.pictureId,
      task: ticket.task,
      fileName: ticket.name,
      bytes: command.bytes,
    });
  }
}
