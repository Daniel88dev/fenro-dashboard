import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";

import type { PictureStorage } from "@/modules/tasks/application/ports/picture-storage";
import type { PictureType } from "@/modules/tasks/domain";

export type S3PictureStorageSettings = {
  readonly bucket: string;
  readonly region: string;
  /** A local stand-in such as S3Mock. Unset, this is AWS itself. */
  readonly endpoint?: string;
  /**
   * Keys for that stand-in. On AWS they stay unset: the SDK finds the App
   * Runner instance role's credentials itself, so no key exists to leak.
   */
  readonly credentials?: {
    readonly accessKeyId: string;
    readonly secretAccessKey: string;
  };
};

/**
 * Pictures kept in a private S3 bucket. Only the app reads and writes it:
 * bytes come in through the app's own upload routes and go out through
 * /api/pictures/<id>, so the bucket needs no public access, CORS or signed
 * links.
 */
export class S3PictureStorage implements PictureStorage {
  readonly configured = true;
  readonly #bucket: string;
  readonly #client: Pick<S3Client, "send">;

  constructor(
    settings: S3PictureStorageSettings,
    client: Pick<S3Client, "send"> = s3Client(settings),
  ) {
    this.#bucket = settings.bucket;
    this.#client = client;
  }

  async put(file: {
    readonly name: string;
    readonly type: PictureType;
    readonly bytes: Uint8Array;
  }): Promise<{ readonly key: string }> {
    const key = crypto.randomUUID();
    await this.#client.send(
      new PutObjectCommand({
        Bucket: this.#bucket,
        Key: key,
        Body: file.bytes,
        ContentType: file.type,
        ContentLength: file.bytes.byteLength,
      }),
    );
    return { key };
  }

  async read(key: string): Promise<Uint8Array | undefined> {
    try {
      const object = await this.#client.send(
        new GetObjectCommand({ Bucket: this.#bucket, Key: key }),
      );
      return object.Body ? await object.Body.transformToByteArray() : undefined;
    } catch (error) {
      if (isMissing(error)) return undefined;
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    await this.#client.send(
      new DeleteObjectCommand({ Bucket: this.#bucket, Key: key }),
    );
  }
}

function s3Client(settings: S3PictureStorageSettings): S3Client {
  return new S3Client({
    region: settings.region,
    ...(settings.endpoint
      ? // Local stand-ins serve buckets as a path, not as a subdomain.
        { endpoint: settings.endpoint, forcePathStyle: true }
      : {}),
    ...(settings.credentials ? { credentials: settings.credentials } : {}),
  });
}

function isMissing(error: unknown): boolean {
  return (
    error instanceof NoSuchKey ||
    (error instanceof S3ServiceException &&
      error.$metadata.httpStatusCode === 404)
  );
}
