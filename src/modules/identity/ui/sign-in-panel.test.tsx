import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SignInPanel, signInErrorMessage } from "./sign-in-panel";

const noop = async () => {};

describe("SignInPanel", () => {
  it("offers GitHub as the one way in", () => {
    render(<SignInPanel action={noop} />);

    expect(
      screen.getByRole("heading", { name: "Sign in to see your repositories" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sign in with GitHub" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("says why the last attempt failed", () => {
    render(<SignInPanel action={noop} error="It went wrong." />);

    expect(screen.getByRole("alert")).toHaveTextContent("It went wrong.");
  });
});

describe("signInErrorMessage", () => {
  it("is silent when nothing failed", () => {
    expect(signInErrorMessage(undefined)).toBeNull();
  });

  it("puts a cancelled consent screen in plain words", () => {
    expect(signInErrorMessage("access_denied")).toMatch(/cancelled/);
  });

  it("names any other code so it can be looked up", () => {
    expect(signInErrorMessage("state_mismatch")).toContain("state_mismatch");
  });
});
