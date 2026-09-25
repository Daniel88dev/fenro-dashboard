import { describe, expect, it } from "vitest";

import { parseTheme, themeAttribute } from "./theme";

describe("parseTheme", () => {
  it.each(["system", "light", "dark"] as const)("keeps %s", (theme) => {
    expect(parseTheme(theme)).toBe(theme);
  });

  it.each([undefined, "", "sepia"])(
    "falls back to the OS setting for %s",
    (value) => {
      expect(parseTheme(value)).toBe("system");
    },
  );
});

describe("themeAttribute", () => {
  it("leaves the html element alone when the OS decides", () => {
    expect(themeAttribute("system")).toBeUndefined();
  });

  it("names a picked scheme", () => {
    expect(themeAttribute("light")).toBe("light");
    expect(themeAttribute("dark")).toBe("dark");
  });
});
