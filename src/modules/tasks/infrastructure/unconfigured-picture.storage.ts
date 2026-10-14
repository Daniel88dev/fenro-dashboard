import type { PictureStorage } from "@/modules/tasks/application/ports/picture-storage";

/** Standing in when no store is set up: nothing can be stored. */
export class UnconfiguredPictureStorage implements PictureStorage {
  readonly configured = false;

  async put(): Promise<{ readonly key: string }> {
    throw new Error("No picture storage is configured.");
  }

  async read(): Promise<undefined> {
    return undefined;
  }

  async remove(): Promise<void> {}
}
