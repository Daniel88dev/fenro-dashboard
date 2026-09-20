import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import { ToggleButton } from "./toggle-button";

const NAME = "12 open pull requests in nordwind/billing-core";

describe("ToggleButton", () => {
  beforeEach(() => {
    push.mockClear();
  });

  it("says what it controls and whether it is open", () => {
    render(
      <ToggleButton
        label={NAME}
        href="/repositories?open=nordwind%2Fbilling-core%3Aprs"
        expanded={false}
        controls="panel-nordwind-billing-core-prs"
      >
        12
      </ToggleButton>,
    );

    const button = screen.getByRole("button", { name: NAME });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveAttribute(
      "aria-controls",
      "panel-nordwind-billing-core-prs",
    );
  });

  it("navigates to the url that opens the panel, without scrolling", () => {
    render(
      <ToggleButton
        label={NAME}
        href="/repositories?open=nordwind%2Fbilling-core%3Aprs"
        expanded={false}
        controls="panel-nordwind-billing-core-prs"
      >
        12
      </ToggleButton>,
    );

    fireEvent.click(screen.getByRole("button"));

    expect(push).toHaveBeenCalledWith(
      "/repositories?open=nordwind%2Fbilling-core%3Aprs",
      { scroll: false },
    );
  });

  it("leaves focus on the count that was clicked", () => {
    render(
      <ToggleButton
        label={NAME}
        href="/repositories"
        expanded
        controls="panel-nordwind-billing-core-prs"
      >
        12
      </ToggleButton>,
    );

    const button = screen.getByRole("button");
    button.focus();
    fireEvent.click(button);

    expect(document.activeElement).toBe(button);
  });
});
