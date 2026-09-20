import { describe, expect, it } from "vitest";

import { formatAge, formatRelativeTime } from "./format";

const now = new Date("2026-09-20T12:00:00Z");
const ago = (milliseconds: number) => new Date(now.getTime() - milliseconds);

describe("formatRelativeTime", () => {
  it("counts minutes, then hours, then days", () => {
    expect(formatRelativeTime(ago(26 * 60_000), now)).toBe("26 min ago");
    expect(formatRelativeTime(ago(60 * 60_000), now)).toBe("1 h ago");
    expect(formatRelativeTime(ago(4 * 3_600_000), now)).toBe("4 h ago");
    expect(formatRelativeTime(ago(3 * 86_400_000), now)).toBe("3 d ago");
  });

  it("says just now under a minute, and never counts backwards", () => {
    expect(formatRelativeTime(ago(20_000), now)).toBe("just now");
    expect(formatRelativeTime(new Date(now.getTime() + 60_000), now)).toBe(
      "just now",
    );
  });
});

describe("formatAge", () => {
  it("reads as the prototype's meta line does", () => {
    expect(formatAge(ago(51 * 86_400_000), now)).toBe("51 d");
    expect(formatAge(ago(5 * 3_600_000), now)).toBe("5 h");
    expect(formatAge(ago(30_000), now)).toBe("1 min");
  });
});
