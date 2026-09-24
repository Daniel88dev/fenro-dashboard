import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AccountMenu } from "./account-menu";

describe("AccountMenu", () => {
  it("shows who is signed in, and opens to settings and a way out", () => {
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

    const toggle = screen.getByLabelText("Account menu for Daniel88dev");
    expect(toggle).toHaveTextContent("Daniel88dev");

    fireEvent.click(toggle);

    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings",
    );
    expect(
      screen.getByRole("button", { name: "Sign out" }),
    ).toBeInTheDocument();
  });
});
