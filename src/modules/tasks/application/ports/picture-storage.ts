import type { PictureType } from "@/modules/tasks/domain";

/**
 * Where pictures' bytes live: UploadThing today, any object store tomorrow.
 * The domain keeps only the key this hands back.
 */
export interface PictureStorage {
  /** False when no store is configured: pictures cannot be added. */
  readonly configured: boolean;
  /** Store the bytes, and say the key they are kept under. */
  put(file: {
    readonly name: string;
    readonly type: PictureType;
    readonly bytes: Uint8Array;
  }): Promise<{ readonly key: string }>;
  /** A short-lived address a browser can load the picture from. */
  link(key: string): Promise<string>;
  /** The bytes, or undefined when the store no longer has them. */
  read(key: string): Promise<Uint8Array | undefined>;
  remove(key: string): Promise<void>;
}
