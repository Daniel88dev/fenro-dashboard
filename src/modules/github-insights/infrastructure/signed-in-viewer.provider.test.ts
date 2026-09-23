import { describe, expect, it, vi } from "vitest";

import { SignedInViewerProvider } from "./signed-in-viewer.provider";

describe("SignedInViewerProvider", () => {
  it("is the signed-in GitHub account, with its token", async () => {
    const provider = new SignedInViewerProvider({
      login: async () => "Daniel88dev",
      accessToken: async () => "gho_token",
    });

    await expect(provider.current()).resolves.toEqual({
      login: "Daniel88dev",
      accessToken: "gho_token",
    });
  });

  it("is nobody when nobody is signed in, and asks for no token", async () => {
    const accessToken = vi.fn(async () => "gho_token");
    const provider = new SignedInViewerProvider({
      login: async () => null,
      accessToken,
    });

    await expect(provider.current()).resolves.toBeNull();
    expect(accessToken).not.toHaveBeenCalled();
  });

  it("is nobody when the account has no GitHub token", async () => {
    const provider = new SignedInViewerProvider({
      login: async () => "Daniel88dev",
      accessToken: async () => null,
    });

    await expect(provider.current()).resolves.toBeNull();
  });
});
