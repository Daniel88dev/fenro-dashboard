import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { describe, expect, it } from "vitest";

import { S3PictureStorage } from "./s3-picture.storage";

const SETTINGS = { bucket: "fenro-pictures", region: "eu-central-1" };
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

/** Records what was sent and answers like S3 would. */
function fakeS3(answer: (command: unknown) => unknown = () => ({})) {
  const sent: unknown[] = [];
  return {
    sent,
    send: async (command: unknown) => {
      sent.push(command);
      return answer(command);
    },
  };
}

function storage(client: ReturnType<typeof fakeS3>) {
  return new S3PictureStorage(SETTINGS, client as never);
}

describe("pictures in S3", () => {
  it("stores the bytes under a fresh key with their type", async () => {
    const s3 = fakeS3();

    const first = await storage(s3).put({
      name: "screen.png",
      type: "image/png",
      bytes: PNG,
    });
    const second = await storage(s3).put({
      name: "screen.png",
      type: "image/png",
      bytes: PNG,
    });

    expect(first.key).not.toBe(second.key);
    const put = s3.sent[0] as PutObjectCommand;
    expect(put).toBeInstanceOf(PutObjectCommand);
    expect(put.input).toMatchObject({
      Bucket: "fenro-pictures",
      Key: first.key,
      Body: PNG,
      ContentType: "image/png",
      ContentLength: PNG.byteLength,
    });
  });

  it("reads the bytes back", async () => {
    const s3 = fakeS3(() => ({
      Body: { transformToByteArray: async () => PNG },
    }));

    expect(await storage(s3).read("key-1")).toEqual(PNG);
    const get = s3.sent[0] as GetObjectCommand;
    expect(get).toBeInstanceOf(GetObjectCommand);
    expect(get.input).toEqual({ Bucket: "fenro-pictures", Key: "key-1" });
  });

  it("says a missing picture is missing rather than failing", async () => {
    const missing = fakeS3(() => {
      throw new NoSuchKey({ message: "gone", $metadata: {} });
    });
    const notFound = fakeS3(() => {
      throw new S3ServiceException({
        name: "NotFound",
        $fault: "client",
        $metadata: { httpStatusCode: 404 },
      });
    });

    expect(await storage(missing).read("key-1")).toBeUndefined();
    expect(await storage(notFound).read("key-1")).toBeUndefined();
  });

  it("lets other failures through, so a broken store is not an empty one", async () => {
    const denied = fakeS3(() => {
      throw new S3ServiceException({
        name: "AccessDenied",
        $fault: "client",
        $metadata: { httpStatusCode: 403 },
      });
    });

    await expect(storage(denied).read("key-1")).rejects.toThrow();
  });

  it("removes the object", async () => {
    const s3 = fakeS3();

    await storage(s3).remove("key-1");

    const remove = s3.sent[0] as DeleteObjectCommand;
    expect(remove).toBeInstanceOf(DeleteObjectCommand);
    expect(remove.input).toEqual({ Bucket: "fenro-pictures", Key: "key-1" });
  });
});
