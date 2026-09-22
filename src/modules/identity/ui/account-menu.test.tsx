import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AccountMenu } from "./account-menu";

describe("AccountMenu", () => {
  it("shows who is signed in and a way out", () => {
    render(
      <AccountMenu
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
