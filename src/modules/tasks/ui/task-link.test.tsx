import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

let pathname = "/tasks";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ refresh: vi.fn(), back: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: (props: ComponentProps<"a">) => <a data-router-link="" {...props} />,
}));

import { isTaskPage, TaskLink } from "./task-link";

afterEach(() => {
  pathname = "/tasks";
});

const routed = (name: string) =>
  screen.getByRole("link", { name }).hasAttribute("data-router-link");

describe("TaskLink", () => {
  it("goes through the router where no task dialogs are mounted", () => {
    render(<TaskLink href="/tasks/T-2">T-2</TaskLink>);

    expect(screen.getByRole("link", { name: "T-2" })).toHaveAttribute(
      "href",
      "/tasks/T-2",
    );
    expect(routed("T-2")).toBe(true);
  });

  it("loads the new task form as a full page from a task page", () => {
    pathname = "/tasks/T-1";
    render(<TaskLink href="/tasks/new?parent=T-1">Add sub-task</TaskLink>);

    expect(routed("Add sub-task")).toBe(false);
  });
});

describe("isTaskPage", () => {
  it("tells a task page from the list and the new task form", () => {
    expect(isTaskPage("/tasks/HAL-6")).toBe(true);
    expect(isTaskPage("/tasks")).toBe(false);
    expect(isTaskPage("/tasks/new")).toBe(false);
    expect(isTaskPage("/")).toBe(false);
  });
});
