import { AggregateRoot, err, ok, UniqueId, type Result } from "@/shared/domain";

import type { Actor } from "./actor";
import { taskError, type TaskError } from "./errors";
import { PictureAdded, PictureRemoved } from "./events";

/**
 * The kinds of picture a task takes. SVG is left out on purpose: it is a
 * document that can carry script, and pictures are shown to the owner in the
 * app's own pages.
 */
export const PICTURE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export type PictureType = (typeof PICTURE_TYPES)[number];

/**
 * 4 MB. A picture reaches the server in one request body, and hosts cap those
 * (Vercel at 4.5 MB), so a larger one would fail on the way in rather than
 * here with a message saying why.
 */
export const MAX_PICTURE_BYTES = 4 * 1024 * 1024;

const EXTENSIONS: Record<PictureType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

const startsWith = (bytes: Uint8Array, prefix: readonly number[], at = 0) =>
  prefix.every((byte, index) => bytes[at + index] === byte);

/**
 * What a file is, from its first bytes. The type a browser or an agent claims
 * is not trusted: a picture is what its bytes say it is.
 */
export function sniffPictureType(bytes: Uint8Array): PictureType | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return "image/gif";
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return "image/webp";
  }
  return null;
}

const MAX_NAME = 120;

/**
 * The name a picture is shown under: the file's own name without any folder,
 * trimmed to fit, ending in the extension its bytes call for.
 */
export function pictureName(raw: string, type: PictureType): string {
  const base =
    raw
      .split(/[\\/]/)
      .pop()!
      // Control characters and the like would only garble the page.
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .replace(/\s+/g, " ")
      .trim() || "picture";
  const extension = EXTENSIONS[type];
  const fits =
    type === "image/jpeg" ? /\.jpe?g$/i : new RegExp(`\\.${extension}$`, "i");
  // A name ending in the wrong extension for its bytes gets the right one.
  const named = fits.test(base)
    ? base
    : `${base.replace(PICTURE_EXTENSION, "")}.${extension}`;
  if (named.length <= MAX_NAME) return named;
  const suffix = named.slice(named.lastIndexOf("."));
  return `${named.slice(0, MAX_NAME - suffix.length)}${suffix}`;
}

const PICTURE_EXTENSION = /\.(png|jpe?g|webp|gif)$/i;

function invalidPicture(message: string): TaskError {
  return taskError("invalid-picture", message);
}

/**
 * A file offered as a picture, checked before anything is stored: it must be
 * one of the picture types, by its bytes, and fit the size limit.
 */
export class PictureFile {
  private constructor(
    readonly name: string,
    readonly type: PictureType,
    readonly bytes: Uint8Array,
  ) {}

  static read(name: string, bytes: Uint8Array): Result<PictureFile, TaskError> {
    if (bytes.byteLength === 0) {
      return err(
        invalidPicture("The file is empty. Send the picture's bytes."),
      );
    }
    if (bytes.byteLength > MAX_PICTURE_BYTES) {
      const megabytes = (bytes.byteLength / 1024 / 1024).toFixed(1);
      return err(
        invalidPicture(
          `The picture is ${megabytes} MB; the limit is 4 MB. Save it smaller (a PNG screenshot at 1x, or a JPEG) and try again.`,
        ),
      );
    }
    const type = sniffPictureType(bytes);
    if (!type) {
      return err(
        invalidPicture(
          "That is not a PNG, JPEG, WebP or GIF picture. Other files, SVG included, cannot be added.",
        ),
      );
    }
    return ok(new PictureFile(pictureName(name, type), type, bytes));
  }

  get byteSize(): number {
    return this.bytes.byteLength;
  }
}

type Props = {
  readonly ownerId: string;
  readonly taskId: string;
  readonly name: string;
  readonly type: PictureType;
  readonly byteSize: number;
  /** Where the storage adapter keeps the bytes. */
  readonly storageKey: string;
  readonly addedBy: Actor;
  /** The session the adder held on the task at the time, if any. */
  readonly sessionId: string | null;
  readonly addedAt: Date;
};

export type NewPicture = {
  readonly id: string;
  readonly ownerId: string;
  readonly taskId: string;
  readonly file: PictureFile;
  readonly storageKey: string;
  readonly addedBy: Actor;
  readonly sessionId: string | null;
  readonly now: Date;
};

/**
 * A picture on a task: a screenshot, a design from a prototype, a photo of a
 * whiteboard. Its own aggregate rather than part of `Task`: nothing about a
 * picture changes the rules a task keeps, and loading every task would
 * otherwise load its pictures too. It belongs to its task's owner, and goes
 * when it is removed; there is nothing to edit.
 */
export class Picture extends AggregateRoot<Props> {
  private constructor(id: UniqueId, props: Props) {
    super(id, props);
  }

  static add(input: NewPicture): Picture {
    const picture = new Picture(UniqueId.create(input.id), {
      ownerId: input.ownerId,
      taskId: input.taskId,
      name: input.file.name,
      type: input.file.type,
      byteSize: input.file.byteSize,
      storageKey: input.storageKey,
      addedBy: input.addedBy,
      sessionId: input.sessionId,
      addedAt: input.now,
    });
    picture.record(new PictureAdded(input.id, input.taskId, input.now));
    return picture;
  }

  /** Rebuild a picture a store already holds, recording no event. */
  static restore(id: UniqueId, props: Props): Picture {
    return new Picture(id, props);
  }

  remove(now: Date): void {
    this.record(new PictureRemoved(this.id.value, this.props.taskId, now));
  }

  get ownerId(): string {
    return this.props.ownerId;
  }

  get taskId(): string {
    return this.props.taskId;
  }

  get name(): string {
    return this.props.name;
  }

  get type(): PictureType {
    return this.props.type;
  }

  get byteSize(): number {
    return this.props.byteSize;
  }

  get storageKey(): string {
    return this.props.storageKey;
  }

  get addedBy(): Actor {
    return this.props.addedBy;
  }

  get sessionId(): string | null {
    return this.props.sessionId;
  }

  get addedAt(): Date {
    return this.props.addedAt;
  }
}

export function isPictureType(value: unknown): value is PictureType {
  return PICTURE_TYPES.includes(value as PictureType);
}

export function pictureNotFound(reference: string): TaskError {
  return taskError(
    "picture-not-found",
    `There is no picture ${reference}. get_task lists a task's pictures with their ids.`,
  );
}
