import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { proxy } from "./proxy";

const request = (path: string, nextUrl?: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    headers: nextUrl ? { "next-url": nextUrl } : {},
  });

const forwarded = (path: string, nextUrl?: string) =>
  proxy(request(path, nextUrl)).headers.get("x-middleware-override-headers");

describe("proxy", () => {
  it("lets a task page refresh itself behind a task dialog", () => {
    const overridden = forwarded("/tasks/T-1", "/tasks/T-1");

    expect(overridden).not.toBeNull();
    expect(overridden?.split(",")).not.toContain("next-url");
  });

  it("still opens a task from another page as a dialog", () => {
    expect(forwarded("/tasks/T-2", "/tasks/T-1")).toBeNull();
    expect(forwarded("/tasks/T-2", "/tasks")).toBeNull();
  });
});
