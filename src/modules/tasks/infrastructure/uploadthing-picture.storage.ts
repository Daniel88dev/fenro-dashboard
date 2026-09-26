import { UTApi, UTFile } from "uploadthing/server";

import type { PictureStorage } from "@/modules/tasks/application/ports/picture-storage";
import type { PictureType } from "@/modules/tasks/domain";

/** How long a link to a picture works: long enough to look at it. */
const LINK_LIFETIME = "1h";

/**
 * Pictures kept in UploadThing, uploaded from the server with its UTApi. The
 * bytes pass through the app on their way, which keeps one path for people
 * and agents and needs no callback from UploadThing into the app.
 *
 * Links are signed, so they work whether the UploadThing app keeps files
 * public or private.
 */
export class UploadThingPictureStorage implements PictureStorage {
  readonly configured = true;
  readonly #api: UTApi;

  constructor(token: string) {
    this.#api = new UTApi({ token, logLevel: "Error" });
  }

  async put(file: {
    readonly name: string;
    readonly type: PictureType;
    readonly bytes: Uint8Array;
  }): Promise<{ readonly key: string }> {
    const result = await this.#api.uploadFiles(
      new UTFile([file.bytes as Uint8Array<ArrayBuffer>], file.name, {
        type: file.type,
      }),
    );
    if (result.error) throw new Error(result.error.message);
    return { key: result.data.key };
  }

  async link(key: string): Promise<string> {
    const { ufsUrl } = await this.#api.generateSignedURL(key, {
      expiresIn: LINK_LIFETIME,
    });
    return ufsUrl;
  }

  async read(key: string): Promise<Uint8Array | undefined> {
    const response = await fetch(await this.link(key));
    if (!response.ok) return undefined;
    return new Uint8Array(await response.arrayBuffer());
  }

  async remove(key: string): Promise<void> {
    await this.#api.deleteFiles(key);
  }
}

/** Standing in when no UploadThing token is set: nothing can be stored. */
export class UnconfiguredPictureStorage implements PictureStorage {
  readonly configured = false;

  async put(): Promise<{ readonly key: string }> {
    throw new Error("No picture storage is configured.");
  }

  async link(): Promise<string> {
    throw new Error("No picture storage is configured.");
  }

  async read(): Promise<undefined> {
    return undefined;
  }

  async remove(): Promise<void> {}
}
