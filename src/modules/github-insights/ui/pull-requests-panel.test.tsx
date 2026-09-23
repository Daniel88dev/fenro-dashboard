import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import type { PullRequestSummary } from "@/modules/github-insights/application/queries/read-models";

import { PullRequestsPanel, type PullRequestView } from "./pull-requests-panel";

const now = new Date("2026-09-23T12:00:00Z");

const summary: PullRequestSummary = {
  number: 476,
  title: "Round invoices half-even",
  author: "mira",
  openedAt: new Date("2026-09-20T12:00:00Z"),
  reviewState: "your-review",
  reviewLabel: "your review",
  checkRollup: "failed",
  checkSummary: "1 failed",
};

function view(expanded: boolean): PullRequestView {
  return {
    summary,
    expanded,
    href: "/repositories",
    checksId: "checks-476",
    checks: <p id="checks-476">Loading the checks for #476…</p>,
  };
}

function renderPanel(views: PullRequestView[]) {
  render(
    <PullRequestsPanel
      id="prs"
      owner="nordwind"
      name="billing-core"
      data={{
        summary: "1 waiting on your review",
        totalOpen: 1,
        shown: [summary],
      }}
      views={views}
      now={now}
    />,
  );
}

describe("PullRequestsPanel", () => {
  it("renders an open pull request's checks where its button points", () => {
    renderPanel([view(true)]);

    const button = screen.getByRole("button", {
      name: "Checks for pull request 476, Round invoices half-even",
    });
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button).toHaveAttribute("aria-controls", "checks-476");
    expect(
      screen.getByText("Loading the checks for #476…"),
    ).toBeInTheDocument();
  });

  it("leaves the checks out while the pull request is closed", () => {
    renderPanel([view(false)]);

    expect(
      screen.queryByText("Loading the checks for #476…"),
    ).not.toBeInTheDocument();
  });
});
