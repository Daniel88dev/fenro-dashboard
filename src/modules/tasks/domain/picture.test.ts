import { describe, expect, it } from "vitest";

import {
  MAX_PICTURE_BYTES,
  PictureFile,
  pictureName,
  sniffPictureType,
} from "./picture";

const bytes = (...values: number[]) => new Uint8Array(values);

describe("what a file is", () => {
  it("goes by the bytes, not the name", () => {
    expect(
      sniffPictureType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)),
    ).toBe("image/png");
    expect(sniffPictureType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffPictureType(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBe(
      "image/gif",
    );
    expect(
      sniffPictureType(
        bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50),
      ),
    ).toBe("image/webp");
    expect(sniffPictureType(new TextEncoder().encode("<svg>"))).toBeNull();
  });
});

describe("a picture's name", () => {
  it("drops folders and control characters and ends in the right extension", () => {
    expect(pictureName("../../etc/shot\u0000", "image/png")).toBe("shot.png");
    expect(pictureName("C:\\designs\\a.jpeg", "image/jpeg")).toBe("a.jpeg");
    expect(pictureName("renamed.png", "image/jpeg")).toBe("renamed.jpg");
    expect(pictureName("   ", "image/gif")).toBe("picture.gif");
  });

  it("keeps a long name to 120 characters with its extension", () => {
    const name = pictureName(`${"a".repeat(200)}.webp`, "image/webp");
    expect(name).toHaveLength(120);
    expect(name.endsWith(".webp")).toBe(true);
  });
});

describe("a file offered as a picture", () => {
  const png = (size: number) => {
    const file = new Uint8Array(size);
    file.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    return file;
  };

  it("takes a picture up to 4 MB", () => {
    const read = PictureFile.read("big.png", png(MAX_PICTURE_BYTES));
    expect(read.ok && read.value.byteSize).toBe(MAX_PICTURE_BYTES);
  });

  it("refuses one over 4 MB, an empty file and anything else", () => {
    for (const file of [
      png(MAX_PICTURE_BYTES + 1),
      new Uint8Array(),
      bytes(1, 2, 3),
    ]) {
      const read = PictureFile.read("x.png", file);
      expect(!read.ok && read.error.code).toBe("invalid-picture");
    }
  });
});
