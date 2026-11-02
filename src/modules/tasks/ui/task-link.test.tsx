import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { isTaskPage, OnTaskPage, TaskLink } from "./task-link";

vi.mock("next/link", () => ({
  default: (props: ComponentProps<"a">) => <a data-router-link="" {...props} />,
}));

const routed = (name: string) =>
  screen.getByRole("link", { name }).hasAttribute("data-router-link");

describe("TaskLink", () => {
  it("loads another task as a full page from a task page", () => {
    render(
      <OnTaskPage>
        <TaskLink href="/tasks/T-2">T-2</TaskLink>
      </OnTaskPage>,
    );

    expect(screen.getByRole("link", { name: "T-2" })).toHaveAttribute(
      "href",
      "/tasks/T-2",
    );
    expect(routed("T-2")).toBe(false);
  });

  it("goes through the router elsewhere, so the task opens as a dialog", () => {
    render(<TaskLink href="/tasks/T-2">T-2</TaskLink>);

    expect(routed("T-2")).toBe(true);
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
