import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RateLimitBanner } from "./dashboard-header";

const now = new Date("2026-09-23T12:00:00Z");

describe("RateLimitBanner", () => {
  it("says once that GitHub's rate limit ran out, and how old the numbers are", () => {
    render(
      <RateLimitBanner syncedAt={new Date("2026-09-23T11:34:00Z")} now={now} />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "GitHub's rate limit is used up. These numbers are from 26 min ago.",
    );
  });

  it("says so when nothing had synced before the limit ran out", () => {
    render(<RateLimitBanner syncedAt={null} now={now} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Nothing has synced yet.",
    );
  });
});
