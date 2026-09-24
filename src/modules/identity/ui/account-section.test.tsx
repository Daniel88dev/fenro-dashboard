import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AccountSection } from "./account-section";

describe("AccountSection", () => {
  it("names the signed-in account and offers a way out", () => {
    render(
      <AccountSection
        user={{
          id: "u1",
          name: "Daniel",
          githubLogin: "Daniel88dev",
          image: null,
        }}
        signOutAction={async () => {}}
      />,
    );

    expect(screen.getByText("Daniel88dev")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sign out" }),
    ).toBeInTheDocument();
  });
});
