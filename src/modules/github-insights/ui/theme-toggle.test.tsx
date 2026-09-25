import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ThemeToggle } from "./theme-toggle";

function clearCookie() {
  document.cookie = "fenro-theme=; path=/; max-age=0";
}

describe("ThemeToggle", () => {
  afterEach(() => {
    delete document.documentElement.dataset.theme;
    clearCookie();
  });

  it("shows the saved choice as pressed", () => {
    render(<ThemeToggle initial="dark" />);

    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Match system" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("switches the page to the picked scheme and remembers it", () => {
    render(<ThemeToggle initial="system" />);

    fireEvent.click(screen.getByRole("button", { name: "Light" }));

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.cookie).toContain("fenro-theme=light");
    expect(screen.getByRole("button", { name: "Light" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("hands the scheme back to the OS when Match system is picked", () => {
    document.documentElement.dataset.theme = "dark";
    render(<ThemeToggle initial="dark" />);

    fireEvent.click(screen.getByRole("button", { name: "Match system" }));

    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(document.cookie).toContain("fenro-theme=system");
  });
});
