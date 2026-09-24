import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PullRequestChecksView } from "./pull-request-checks-view";

const checks = {
  headSha: "a87de28",
  checks: [{ name: "lint", duration: "39 s", conclusion: "failed" as const }],
  blockingReason: "The lint job is red.",
};

describe("PullRequestChecksView", () => {
  it("offers to make a task from the pull request where the route says", () => {
    render(
      <PullRequestChecksView
        id="checks"
        checks={checks}
        newTaskHref="/tasks/new?from=x"
      />,
    );

    expect(
      screen.getByRole("link", { name: "Make a task from this" }),
    ).toHaveAttribute("href", "/tasks/new?from=x");
  });

  it("leaves it out when the route offers no tasks", () => {
    render(<PullRequestChecksView id="checks" checks={checks} />);

    expect(
      screen.queryByRole("link", { name: "Make a task from this" }),
    ).toBeNull();
  });
});
