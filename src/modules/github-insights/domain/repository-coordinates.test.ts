import { describe, expect, it } from "vitest";

import { isErr, isOk, unwrap } from "@/shared/domain";

import { RepositoryCoordinates } from "./repository-coordinates";

describe("RepositoryCoordinates", () => {
  it("accepts an owner and a name", () => {
    const coordinates = unwrap(
      RepositoryCoordinates.create("nordwind", "billing-core"),
    );

    expect(coordinates.owner).toBe("nordwind");
    expect(coordinates.name).toBe("billing-core");
    expect(coordinates.fullName).toBe("nordwind/billing-core");
  });

  it("parses the owner/name form and ignores surrounding slashes and spaces", () => {
    const coordinates = unwrap(
      RepositoryCoordinates.parse("  /Daniel88dev/fenro-dashboard/ "),
    );

    expect(coordinates.fullName).toBe("Daniel88dev/fenro-dashboard");
  });

  it("refuses anything that is not exactly two segments", () => {
    expect(isErr(RepositoryCoordinates.parse("billing-core"))).toBe(true);
    expect(
      isErr(RepositoryCoordinates.parse("github.com/nordwind/billing-core")),
    ).toBe(true);
  });

  it("refuses an owner or a name GitHub would not allow", () => {
    expect(isErr(RepositoryCoordinates.create("nord wind", "core"))).toBe(true);
    expect(isErr(RepositoryCoordinates.create("nordwind", ""))).toBe(true);
    expect(isErr(RepositoryCoordinates.create("nordwind", ".."))).toBe(true);
  });

  it("reports an invalid value rather than throwing", () => {
    const result = RepositoryCoordinates.parse("nope");

    expect(isOk(result)).toBe(false);
    if (isErr(result)) {
      expect(result.error.code).toBe("invalid-coordinates");
      expect(result.error.message).toContain("owner/name");
    }
  });

  it("compares by value", () => {
    const one = unwrap(RepositoryCoordinates.create("nordwind", "edge-proxy"));
    const other = unwrap(RepositoryCoordinates.parse("nordwind/edge-proxy"));

    expect(one.equals(other)).toBe(true);
  });
});
