import { describe, expect, it } from "vitest";

import { getEnv } from "./env";

describe("getEnv", () => {
  it("applies defaults for optional settings", () => {
    const env = getEnv({ NODE_ENV: "test" });

    expect(env.APP_URL).toBe("http://localhost:3000");
    expect(env.GITHUB_TOKEN).toBeUndefined();
  });

  it("rejects a malformed value and names it", () => {
    expect(() => getEnv({ APP_URL: "not-a-url" })).toThrow(/APP_URL/);
  });
});
