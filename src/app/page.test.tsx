import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "@/app/page";

describe("Home", () => {
  it("names the app and its bounded contexts", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Fenro Dashboard" }),
    ).toBeInTheDocument();
    expect(screen.getByText("GitHub insights")).toBeInTheDocument();
    expect(screen.getByText("Tasks")).toBeInTheDocument();
  });
});
