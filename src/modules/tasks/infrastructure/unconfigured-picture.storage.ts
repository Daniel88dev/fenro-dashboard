import type { PictureStorage } from "@/modules/tasks/application/ports/picture-storage";

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
