import {
  parseTaskKey,
  taskNotFound,
  type Actor,
  type TaskError,
} from "@/modules/tasks/domain";
import type { Query, QueryHandler } from "@/shared/application";
import { err, ok, type Result } from "@/shared/domain";

import { NOT_CONFIGURED } from "../commands/add-picture";
import type { PictureStorage } from "../ports/picture-storage";
import type { TaskReadStore } from "../ports/task-read-store";
import type { UploadTickets } from "../ports/upload-tickets";

/** Long enough to find the file and run curl, short enough not to leak. */
export const UPLOAD_TICKET_TTL_MS = 15 * 60 * 1000;

export type PictureUploadTicket = {
  readonly token: string;
  readonly expiresAt: string;
};

export type PictureUploadTicketResult = Result<PictureUploadTicket, TaskError>;

/**
 * A link an agent can send one picture's bytes to, for a task that exists.
 * Asking changes nothing: the picture is added when the bytes arrive.
 */
export type PictureUploadTicketQuery = Query<
  "tasks.picture-upload-ticket",
  PictureUploadTicketResult
> & {
  readonly ownerId: string;
  readonly actor: Actor;
  readonly task: string;
  /** Chosen by the caller, so it can name the picture afterwards. */
  readonly pictureId: string;
  readonly name: string;
};

export class PictureUploadTicketHandler implements QueryHandler<
  PictureUploadTicketQuery,
  PictureUploadTicketResult
> {
  constructor(
    private readonly tasks: TaskReadStore,
    private readonly storage: PictureStorage,
    private readonly tickets: UploadTickets,
    private readonly clock: () => Date,
  ) {}

  async handle(
    query: PictureUploadTicketQuery,
  ): Promise<PictureUploadTicketResult> {
    if (!this.storage.configured) return err(NOT_CONFIGURED);

    const reference = query.task.trim();
    const records = await this.tasks.records(query.ownerId);
    const number = parseTaskKey(reference);
    const task = number.ok
      ? records.find((record) => record.number === number.value)
      : records.find((record) => record.id === reference.toLowerCase());
    if (!task) return err(taskNotFound(reference));

    const expiresAt = new Date(this.clock().getTime() + UPLOAD_TICKET_TTL_MS);
    const token = this.tickets.issue({
      ownerId: query.ownerId,
      actor: query.actor,
      task: task.id,
      pictureId: query.pictureId,
      name: query.name,
      expiresAt,
    });
    return ok({ token, expiresAt: expiresAt.toISOString() });
  }
}
