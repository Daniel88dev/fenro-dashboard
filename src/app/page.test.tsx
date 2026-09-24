import { describe, expect, it, vi } from "vitest";

import Home from "@/app/page";

const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`redirected to ${url}`);
  }),
);
vi.mock("next/navigation", () => ({ redirect }));

describe("Home", () => {
  it("sends the reader to the repository table", () => {
    expect(() => Home()).toThrow("redirected to /repositories");
    expect(redirect).toHaveBeenCalledWith("/repositories");
  });
});
