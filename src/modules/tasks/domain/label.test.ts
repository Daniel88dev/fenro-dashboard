import { describe, expect, it } from "vitest";

import { isErr, unwrap } from "@/shared/domain";

import {
  defaultLabelColour,
  Label,
  LABEL_COLOURS,
  parseLabelName,
  pickLabelColour,
} from "./label";

const now = new Date("2026-09-25T10:00:00Z");

describe("a label", () => {
  it("keeps its name lower-case, with spaces as hyphens", () => {
    expect(unwrap(parseLabelName("  Needs   Review "))).toBe("needs-review");
    expect(unwrap(parseLabelName("area:auth"))).toBe("area:auth");
  });

  it("refuses a name it could not be filtered or linked by", () => {
    for (const bad of ["", "-leading", "a,b", "x".repeat(41), "émoji"]) {
      const result = parseLabelName(bad);
      expect(isErr(result) && result.error.code, bad).toBe("invalid-label");
    }
  });

  it("takes the colour it is given, or one its name decides", () => {
    const picked = unwrap(
      Label.create({
        id: "l-1",
        ownerId: "user-1",
        name: "Bug",
        colour: "red",
        now,
      }),
    );
    const defaulted = unwrap(
      Label.create({ id: "l-2", ownerId: "user-1", name: "docs", now }),
    );

    expect([picked.name, picked.colour]).toEqual(["bug", "red"]);
    expect(defaulted.colour).toBe(defaultLabelColour("docs"));
    expect(defaultLabelColour("docs")).toBe(defaultLabelColour("docs"));
    expect(picked.pullDomainEvents().map((event) => event.name)).toEqual([
      "tasks.label-created",
    ]);
  });

  it("spreads default colours over the whole set", () => {
    const names = Array.from({ length: 60 }, (_, index) => `label-${index}`);
    const used = new Set(names.map(defaultLabelColour));
    expect(used.size).toBe(LABEL_COLOURS.length);
  });

  it("picks a colour the owner's other labels use least", () => {
    const colours = [...LABEL_COLOURS];
    const taken = colours.filter((colour) => colour !== "green");
    expect(pickLabelColour("anything", taken)).toBe("green");
    expect(pickLabelColour("docs", [])).toBe(defaultLabelColour("docs"));
    expect(pickLabelColour("docs", colours)).toBe(defaultLabelColour("docs"));
  });
});
