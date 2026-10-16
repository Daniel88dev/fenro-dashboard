import type { PictureType } from "@/modules/tasks/domain";

/** The bytes reach a browser through the app, never from the store directly. */
export interface PictureStorage {
  readonly configured: boolean;
  put(file: {
    readonly name: string;
    readonly type: PictureType;
    readonly bytes: Uint8Array;
  }): Promise<{ readonly key: string }>;
  read(key: string): Promise<Uint8Array | undefined>;
  remove(key: string): Promise<void>;
}
