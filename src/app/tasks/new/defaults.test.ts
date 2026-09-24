import { describe, expect, it } from "vitest";

import { newTaskDefaults } from "./defaults";

describe("newTaskDefaults", () => {
  it("names a task after the pull request it was made from", () => {
    expect(
      newTaskDefaults({
        repository: "nordwind/billing-core",
        from: "https://github.com/nordwind/billing-core/pull/476",
      }),
    ).toEqual({
      repository: "nordwind/billing-core",
      parent: "",
      source: "https://github.com/nordwind/billing-core/pull/476",
      title: "Get pull request #476 merged",
    });
  });

  it("keeps a title that was passed in", () => {
    expect(
      newTaskDefaults({ title: " Tidy up ", parent: ["T-3", "T-4"] }),
    ).toMatchObject({ title: "Tidy up", parent: "T-3" });
  });
});
