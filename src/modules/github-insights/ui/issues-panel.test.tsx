import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import {
  NO_ISSUE_FILTER,
  type OpenIssues,
} from "@/modules/github-insights/application/queries/read-models";

import { gitHubIssueSearchUrl, IssuesPanel } from "./issues-panel";

const now = new Date("2026-09-23T12:00:00Z");

function issues(overrides: Partial<OpenIssues> = {}): OpenIssues {
  return {
    summary: "1 assigned to you",
    totalOpen: 3,
    shown: [
      {
        number: 12,
        title: "Invoices round the wrong way",
        label: "bug",
        openedAt: new Date("2026-09-20T12:00:00Z"),
        assignee: "you",
      },
    ],
    matching: 1,
    complete: true,
    stored: 3,
    ...overrides,
  };
}

const chips = [
  { label: "Assigned to me", href: "/repositories?assigned", pressed: true },
  { label: "Needs triage", href: "/repositories?triage", pressed: false },
  { label: "Oldest first", href: "/repositories?oldest", pressed: false },
];

describe("IssuesPanel", () => {
  beforeEach(() => push.mockClear());

  it("shows the filter chips as toggle buttons that say whether they are pressed", () => {
    render(
      <IssuesPanel
        id="issues"
        owner="nordwind"
        name="billing-core"
        data={issues()}
        filter={{ ...NO_ISSUE_FILTER, assignedToMe: true }}
        chips={chips}
        now={now}
      />,
    );

    expect(
      screen.getByRole("group", {
        name: "Filter the open issues in nordwind/billing-core",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Assigned to me" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Needs triage" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("presses a chip by navigating to its url, without scrolling", () => {
    render(
      <IssuesPanel
        id="issues"
        owner="nordwind"
        name="billing-core"
        data={issues()}
        filter={NO_ISSUE_FILTER}
        chips={chips}
        now={now}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Oldest first" }));

    expect(push).toHaveBeenCalledWith("/repositories?oldest", {
      scroll: false,
    });
  });

  it("says so when a filter leaves nothing", () => {
    render(
      <IssuesPanel
        id="issues"
        owner="nordwind"
        name="billing-core"
        data={issues({ shown: [], matching: 0 })}
        filter={{ ...NO_ISSUE_FILTER, needsTriage: true }}
        chips={chips}
        now={now}
      />,
    );

    expect(
      screen.getByText("No open issue matches these filters."),
    ).toBeInTheDocument();
  });

  it("counts the rest of the matches when every open issue was stored", () => {
    render(
      <IssuesPanel
        id="issues"
        owner="nordwind"
        name="billing-core"
        data={issues({ matching: 11 })}
        filter={{ ...NO_ISSUE_FILTER, assignedToMe: true }}
        chips={chips}
        now={now}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Show the other 10 issues on GitHub" }),
    ).toHaveAttribute(
      "href",
      gitHubIssueSearchUrl("nordwind", "billing-core", {
        ...NO_ISSUE_FILTER,
        assignedToMe: true,
      }),
    );
  });

  it("admits a filter only saw the stored issues when there are more open", () => {
    render(
      <IssuesPanel
        id="issues"
        owner="nordwind"
        name="billing-core"
        data={issues({ totalOpen: 312, stored: 50, complete: false })}
        filter={{ ...NO_ISSUE_FILTER, order: "oldest" }}
        chips={chips}
        now={now}
      />,
    );

    expect(
      screen.getByText(
        /Filtered from the 50 most recently updated of 312 open issues/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "See every match on GitHub" }),
    ).toBeInTheDocument();
  });

  it("offers no chips on a repository with nothing open", () => {
    render(
      <IssuesPanel
        id="issues"
        owner="nordwind"
        name="billing-core"
        data={issues({
          summary: "nothing open",
          totalOpen: 0,
          shown: [],
          matching: 0,
          stored: 0,
        })}
        filter={NO_ISSUE_FILTER}
        chips={chips}
        now={now}
      />,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("gitHubIssueSearchUrl", () => {
  it("asks GitHub for the same narrowing the chips made", () => {
    const url = new URL(
      gitHubIssueSearchUrl("nordwind", "billing-core", {
        assignedToMe: true,
        needsTriage: true,
        order: "oldest",
      }),
    );

    expect(url.pathname).toBe("/nordwind/billing-core/issues");
    expect(url.searchParams.get("q")).toBe(
      "is:issue is:open assignee:@me no:label sort:created-asc",
    );
  });
});
