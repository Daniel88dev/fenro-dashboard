import type { PictureStorage } from "@/modules/tasks/application/ports/picture-storage";

/** Pictures' bytes in a map, for tests. */
export class InMemoryPictureStorage implements PictureStorage {
  readonly configured = true;
  readonly files = new Map<string, Uint8Array>();
  /** Set to make the next put fail, as a store that is down would. */
  failNextPut = false;
  #next = 0;

  async put(file: { readonly bytes: Uint8Array }): Promise<{ key: string }> {
    if (this.failNextPut) {
      this.failNextPut = false;
      throw new Error("Storage is down.");
    }
    this.#next += 1;
    const key = `key-${this.#next}`;
    this.files.set(key, file.bytes);
    return { key };
  }

  async link(key: string): Promise<string> {
    return `https://pictures.test/${key}?signature=test`;
  }

  async read(key: string): Promise<Uint8Array | undefined> {
    return this.files.get(key);
  }

  async remove(key: string): Promise<void> {
    this.files.delete(key);
  }
}
