import { describe, expect, it } from "vitest";

import { toSignedInUser } from "./better-auth.authenticator";

describe("toSignedInUser", () => {
  it("carries the GitHub login and avatar through", () => {
    expect(
      toSignedInUser({
        id: "u1",
        name: "Daniel",
        image: "https://avatars.githubusercontent.com/u/64728456",
        githubLogin: "Daniel88dev",
      }),
    ).toEqual({
      id: "u1",
      name: "Daniel",
      githubLogin: "Daniel88dev",
      image: "https://avatars.githubusercontent.com/u/64728456",
    });
  });

  it("reads a user with no GitHub login as signed out, so sign-in fills it in", () => {
    expect(toSignedInUser({ id: "u1", name: "Daniel" })).toBeNull();
  });
});
