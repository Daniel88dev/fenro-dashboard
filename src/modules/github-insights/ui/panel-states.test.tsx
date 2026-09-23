import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { ChecksLoading, PanelLoading } from "./panel";
import { ChecksBoundary, PanelBoundary } from "./panel-boundary";

function Broken(): never {
  throw new Error("connection refused");
}

describe("a panel on its way", () => {
  it("keeps the panel's title and id, and says what it is loading", () => {
    render(
      <PanelLoading
        id="panel-nordwind-billing-core-prs"
        title="Open pull requests"
        what="pull requests"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Open pull requests" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading pull requests…",
    );
    expect(
      document.getElementById("panel-nordwind-billing-core-prs"),
    ).toHaveAttribute("aria-busy", "true");
  });

  it("says which pull request's checks are loading", () => {
    render(<ChecksLoading id="checks" number={476} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading the checks for #476…",
    );
  });
});

describe("a panel that breaks", () => {
  it("renders its own message and a way to try again, not the error", () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <div>
        <p>billing-core</p>
        <PanelBoundary
          id="panel-nordwind-billing-core-prs"
          title="Open pull requests"
          what="The pull requests"
        >
          <Broken />
        </PanelBoundary>
      </div>,
    );
    quiet.mockRestore();

    expect(screen.getByText("billing-core")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "The pull requests could not be loaded.",
    );
    expect(screen.queryByText(/connection refused/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
    expect(
      document.getElementById("panel-nordwind-billing-core-prs"),
    ).toBeInTheDocument();
  });

  it("does the same for one pull request's checks", () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ChecksBoundary id="checks" number={476}>
        <Broken />
      </ChecksBoundary>,
    );
    quiet.mockRestore();

    expect(screen.getByRole("status")).toHaveTextContent(
      "The checks for #476 could not be loaded.",
    );
  });
});
