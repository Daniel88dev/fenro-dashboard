import { describe, expect, it } from "vitest";

import {
  isIssueChipPressed,
  isOpen,
  isPullRequestOpen,
  panelId,
  parseExpansion,
  toggleIssueChipHref,
  togglePanelHref,
  togglePullRequestHref,
} from "./expansion";

const state = (params: Record<string, string | string[] | undefined>) =>
  parseExpansion(params);

describe("parseExpansion", () => {
  it("reads several open panels from a repeated parameter", () => {
    const parsed = state({
      open: ["nordwind/billing-core:prs", "nordwind/docs-site:issues"],
    });

    expect(parsed.open).toEqual([
      { owner: "nordwind", name: "billing-core", column: "prs" },
      { owner: "nordwind", name: "docs-site", column: "issues" },
    ]);
  });

  it("ignores anything that is not a repository and a known column", () => {
    const parsed = state({
      open: ["billing-core:prs", "nordwind/billing-core:reviews", "nonsense"],
    });

    expect(parsed.open).toEqual([]);
  });

  it("reads the pull request whose checks are showing", () => {
    const parsed = state({ pr: "nordwind/billing-core:476" });

    expect(isPullRequestOpen(parsed, "nordwind", "billing-core", 476)).toBe(
      true,
    );
    expect(isPullRequestOpen(parsed, "nordwind", "billing-core", 482)).toBe(
      false,
    );
  });

  it("refuses a pull request number that is not one", () => {
    expect(state({ pr: "nordwind/billing-core:-1" }).openPullRequests).toEqual(
      [],
    );
    expect(state({ pr: "nordwind/billing-core:abc" }).openPullRequests).toEqual(
      [],
    );
  });
});

describe("togglePanelHref", () => {
  const key = {
    owner: "nordwind",
    name: "billing-core",
    column: "prs",
  } as const;

  it("opens a panel without closing the ones already open", () => {
    const current = state({ open: "nordwind/docs-site:issues" });

    const href = togglePanelHref("/repositories", current, key);

    expect(href).toBe(
      "/repositories?open=nordwind%2Fdocs-site%3Aissues&open=nordwind%2Fbilling-core%3Aprs",
    );
    expect(isOpen(state({ open: ["nordwind/billing-core:prs"] }), key)).toBe(
      true,
    );
  });

  it("closes the panel it is given, and the pull request opened inside it", () => {
    const current = state({
      open: ["nordwind/billing-core:prs", "nordwind/billing-core:tasks"],
      pr: "nordwind/billing-core:476",
    });

    expect(togglePanelHref("/repositories", current, key)).toBe(
      "/repositories?open=nordwind%2Fbilling-core%3Atasks",
    );
  });

  it("keeps the filter across an expansion", () => {
    const current = state({ q: "billing" });

    expect(togglePanelHref("/repositories", current, key)).toBe(
      "/repositories?open=nordwind%2Fbilling-core%3Aprs&q=billing",
    );
  });
});

describe("togglePullRequestHref", () => {
  it("opens and closes one pull request's checks", () => {
    const closed = state({ open: "nordwind/billing-core:prs" });
    const opened = state({
      open: "nordwind/billing-core:prs",
      pr: "nordwind/billing-core:476",
    });

    expect(
      togglePullRequestHref(
        "/repositories",
        closed,
        "nordwind",
        "billing-core",
        476,
      ),
    ).toContain("pr=nordwind%2Fbilling-core%3A476");
    expect(
      togglePullRequestHref(
        "/repositories",
        opened,
        "nordwind",
        "billing-core",
        476,
      ),
    ).toBe("/repositories?open=nordwind%2Fbilling-core%3Aprs");
  });
});

describe("issue chips", () => {
  const issuesOpen = { open: "nordwind/billing-core:issues" };

  it("reads the chips pressed on each issues panel, and drops unknown ones", () => {
    const parsed = state({
      ...issuesOpen,
      issues: [
        "nordwind/billing-core:assigned",
        "nordwind/billing-core:oldest",
        "nordwind/billing-core:stale",
      ],
    });

    expect(
      isIssueChipPressed(parsed, "nordwind", "billing-core", "assigned"),
    ).toBe(true);
    expect(
      isIssueChipPressed(parsed, "nordwind", "billing-core", "oldest"),
    ).toBe(true);
    expect(
      isIssueChipPressed(parsed, "nordwind", "billing-core", "triage"),
    ).toBe(false);
    expect(parsed.issueChips).toHaveLength(2);
  });

  it("presses a chip and releases it again", () => {
    const released = state(issuesOpen);
    const pressed = state({
      ...issuesOpen,
      issues: "nordwind/billing-core:triage",
    });

    expect(
      toggleIssueChipHref(
        "/repositories",
        released,
        "nordwind",
        "billing-core",
        "triage",
      ),
    ).toBe(
      "/repositories?open=nordwind%2Fbilling-core%3Aissues&issues=nordwind%2Fbilling-core%3Atriage",
    );
    expect(
      toggleIssueChipHref(
        "/repositories",
        pressed,
        "nordwind",
        "billing-core",
        "triage",
      ),
    ).toBe("/repositories?open=nordwind%2Fbilling-core%3Aissues");
  });

  it("releases a row's chips when its issues panel closes", () => {
    const current = state({
      open: ["nordwind/billing-core:issues", "nordwind/docs-site:issues"],
      issues: ["nordwind/billing-core:assigned", "nordwind/docs-site:oldest"],
    });

    expect(
      togglePanelHref("/repositories", current, {
        owner: "nordwind",
        name: "billing-core",
        column: "issues",
      }),
    ).toBe(
      "/repositories?open=nordwind%2Fdocs-site%3Aissues&issues=nordwind%2Fdocs-site%3Aoldest",
    );
  });
});

describe("panelId", () => {
  it("is a usable html id for aria-controls", () => {
    expect(
      panelId({ owner: "nordwind", name: "billing-core", column: "prs" }),
    ).toBe("panel-nordwind-billing-core-prs");
  });
});
