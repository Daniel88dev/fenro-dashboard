import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import {
  RepositoryTable,
  type ColumnToggle,
  type RepositoryRowView,
} from "./repository-table";

const now = new Date("2026-09-20T12:00:00Z");

function toggle(overrides: Partial<ColumnToggle> = {}): ColumnToggle {
  return {
    count: 0,
    hint: "nothing open",
    label: "0 tasks in nordwind/billing-core",
    href: "/repositories",
    expanded: false,
    panelId: "panel-nordwind-billing-core-tasks",
    ...overrides,
  };
}

function row(overrides: Partial<RepositoryRowView> = {}): RepositoryRowView {
  return {
    id: "row-1",
    owner: "nordwind",
    name: "billing-core",
    pinned: false,
    lastActivityAt: new Date("2026-09-20T11:34:00Z"),
    syncFailure: null,
    rateLimited: false,
    pullRequests: toggle({
      count: 12,
      hint: "3 need you",
      label: "12 open pull requests in nordwind/billing-core",
      panelId: "panel-nordwind-billing-core-prs",
      href: "/repositories?open=nordwind%2Fbilling-core%3Aprs",
    }),
    issues: toggle({
      count: 38,
      hint: "4 assigned",
      label: "38 open issues in nordwind/billing-core",
      panelId: "panel-nordwind-billing-core-issues",
    }),
    tasks: toggle({ count: 5, hint: "1 running" }),
    panels: [],
    ...overrides,
  };
}

describe("RepositoryTable", () => {
  it("marks a pinned row with a pressed pin that unpins it", () => {
    const pinAction = vi.fn(async () => {});
    render(
      <RepositoryTable
        rows={[row({ pinned: true })]}
        now={now}
        pinAction={pinAction}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Unpin nordwind/billing-core" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("offers to pin a row that is not pinned", () => {
    const pinAction = vi.fn(async () => {});
    render(<RepositoryTable rows={[row()]} now={now} pinAction={pinAction} />);

    expect(
      screen.getByRole("button", {
        name: "Pin nordwind/billing-core to the top",
      }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("shows a row per repository with its counts and hints", () => {
    render(<RepositoryTable rows={[row()]} now={now} />);

    expect(screen.getByText("billing-core")).toBeInTheDocument();
    expect(screen.getByText("nordwind")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("3 need you")).toBeInTheDocument();
    expect(screen.getByText("38")).toBeInTheDocument();
    expect(screen.getByText("26 min ago")).toBeInTheDocument();
  });

  it("labels each count, because a number alone does not say what it counts", () => {
    render(<RepositoryTable rows={[row()]} now={now} />);

    expect(
      screen.getByRole("button", {
        name: "12 open pull requests in nordwind/billing-core",
      }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("renders no panel while the row is collapsed", () => {
    render(<RepositoryTable rows={[row()]} now={now} />);

    expect(
      screen.queryByRole("heading", { name: "Open pull requests" }),
    ).not.toBeInTheDocument();
  });

  it("reveals the panel and flips aria-expanded once the url says it is open", () => {
    render(
      <RepositoryTable
        rows={[
          row({
            pullRequests: toggle({
              count: 12,
              hint: "3 need you",
              label: "12 open pull requests in nordwind/billing-core",
              panelId: "panel-nordwind-billing-core-prs",
              expanded: true,
            }),
            panels: [
              {
                key: "prs",
                node: (
                  <div id="panel-nordwind-billing-core-prs">
                    <h3>Open pull requests</h3>
                  </div>
                ),
              },
            ],
          }),
        ]}
        now={now}
      />,
    );

    const button = screen.getByRole("button", {
      name: "12 open pull requests in nordwind/billing-core",
    });
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button).toHaveAttribute(
      "aria-controls",
      "panel-nordwind-billing-core-prs",
    );
    expect(
      screen.getByRole("heading", { name: "Open pull requests" }),
    ).toBeInTheDocument();
  });

  it("keeps two rows open at once, on different columns", () => {
    render(
      <RepositoryTable
        rows={[
          row({
            id: "row-1",
            panels: [{ key: "prs", node: <h3>Open pull requests</h3> }],
          }),
          row({
            id: "row-2",
            name: "docs-site",
            panels: [{ key: "issues", node: <h3>Open issues</h3> }],
          }),
        ]}
        now={now}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Open pull requests" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Open issues" }),
    ).toBeInTheDocument();
  });

  it("says when the latest sync failed, beside the numbers it kept", () => {
    render(
      <RepositoryTable
        rows={[row({ syncFailure: "GitHub did not answer." })]}
        now={now}
      />,
    );

    expect(
      screen.getByText("Last sync failed: GitHub did not answer."),
    ).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("points at the header when the rate limit stopped a row's sync", () => {
    render(
      <RepositoryTable
        rows={[
          row({
            syncFailure: "GitHub's rate limit is used up for now.",
            rateLimited: true,
          }),
        ]}
        now={now}
      />,
    );

    expect(
      screen.getByText("Not refreshed: rate limit used up"),
    ).toBeInTheDocument();
  });

  it("explains what watching does when nothing is watched", () => {
    render(
      <RepositoryTable
        rows={[]}
        now={now}
        emptyAction={<button type="button">Add repositories</button>}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "Pick the repositories you want to follow",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add repositories" }),
    ).toBeInTheDocument();
  });

  it("says the filter hid everything rather than that nothing is watched", () => {
    render(<RepositoryTable rows={[]} now={now} filteredOut />);

    expect(
      screen.getByText("No watched repository matches this filter."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});
