import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SyncProvider } from "./sync-context";
import { RowSyncIndicator, SyncProgressBar, SyncStatus } from "./sync-status";

const now = new Date("2026-09-23T12:00:00Z");

/** An action that stays pending until the test lets it finish. */
function deferredAction() {
  const pending: (() => void)[] = [];
  const action = vi.fn(
    () => new Promise<void>((resolve) => pending.push(resolve)),
  );
  const finish = async () => {
    await act(async () => {
      pending.splice(0).forEach((resolve) => resolve());
    });
  };
  return { action, finish };
}

function Screen({
  action,
  dueIds = [],
}: {
  action: (trigger: "manual" | "automatic") => Promise<void>;
  dueIds?: string[];
}) {
  return (
    <SyncProvider
      action={action}
      repositoryIds={["repo-1", "repo-2"]}
      dueIds={dueIds}
    >
      <SyncStatus
        syncedAt={new Date("2026-09-23T11:34:00Z")}
        neverSynced={0}
        watched={2}
        now={now}
      />
      <SyncProgressBar />
      <RowSyncIndicator
        repositoryId="repo-1"
        fullName="nordwind/billing-core"
      />
      <RowSyncIndicator repositoryId="repo-2" fullName="nordwind/docs-site" />
      <p>12 open pull requests</p>
    </SyncProvider>
  );
}

describe("SyncStatus", () => {
  it("says once that GitHub's rate limit ran out, and how old the numbers are", () => {
    render(
      <SyncStatus
        syncedAt={new Date("2026-09-23T11:34:00Z")}
        neverSynced={0}
        watched={2}
        rateLimited
        now={now}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "GitHub's rate limit is used up. Showing numbers from 26 min ago.",
    );
    expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
  });

  it("says how fresh the numbers are, and does not sync them when nothing is due", () => {
    const { action } = deferredAction();

    render(<Screen action={action} />);

    expect(screen.getByRole("status")).toHaveTextContent("Synced 26 min ago");
    expect(action).not.toHaveBeenCalled();
    expect(screen.queryByTestId("sync-progress")).not.toBeInTheDocument();
  });

  it("starts syncing on its own when rows are due, keeping the numbers on screen", async () => {
    const { action, finish } = deferredAction();

    render(<Screen action={action} dueIds={["repo-2"]} />);

    expect(action).toHaveBeenCalledWith("automatic");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Updating from GitHub…",
    );
    expect(screen.getByTestId("sync-progress")).toBeInTheDocument();
    expect(
      screen.getByText("Updating nordwind/docs-site from GitHub"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Updating nordwind/billing-core from GitHub"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("12 open pull requests")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();

    await finish();

    expect(screen.queryByTestId("sync-progress")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Synced");
  });

  it("does not ask again for a row it already asked about", async () => {
    const { action, finish } = deferredAction();
    const { rerender } = render(<Screen action={action} dueIds={["repo-2"]} />);
    await finish();

    // GitHub failed, so the server still calls the row due.
    rerender(<Screen action={action} dueIds={["repo-2"]} />);

    expect(action).toHaveBeenCalledTimes(1);
  });

  it("syncs every row when Refresh is pressed", async () => {
    const { action, finish } = deferredAction();
    render(<Screen action={action} />);

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    expect(action).toHaveBeenCalledWith("manual");
    expect(
      screen.getByText("Updating nordwind/billing-core from GitHub"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Updating nordwind/docs-site from GitHub"),
    ).toBeInTheDocument();
    await finish();
  });

  it("says when nothing has synced yet", () => {
    render(
      <SyncStatus syncedAt={null} neverSynced={2} watched={2} now={now} />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Not synced yet");
  });
});
