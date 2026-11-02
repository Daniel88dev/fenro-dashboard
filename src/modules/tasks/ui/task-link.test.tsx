import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

import { isTaskPage, OnTaskPage, TaskLink } from "./task-link";

afterEach(() => {
  refresh.mockReset();
  window.history.replaceState(null, "", "/");
});

vi.mock("next/link", () => ({
  default: (props: ComponentProps<"a">) => <a data-router-link="" {...props} />,
}));

const routed = (name: string) =>
  screen.getByRole("link", { name }).hasAttribute("data-router-link");

describe("TaskLink", () => {
  it("opens another task in the page's own dialog from a task page", () => {
    render(
      <OnTaskPage taskKey="T-1">
        <TaskLink href="/tasks/T-2">T-2</TaskLink>
      </OnTaskPage>,
    );

    const link = screen.getByRole("link", { name: "T-2" });
    expect(link).toHaveAttribute("href", "/tasks/T-1?open=T-2");
    expect(routed("T-2")).toBe(false);

    fireEvent.click(link);

    expect(window.location.pathname + window.location.search).toBe(
      "/tasks/T-1?open=T-2",
    );
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("leaves a modified click to the browser", () => {
    render(
      <OnTaskPage taskKey="T-1">
        <TaskLink href="/tasks/T-2">T-2</TaskLink>
      </OnTaskPage>,
    );

    fireEvent.click(screen.getByRole("link", { name: "T-2" }), {
      metaKey: true,
    });

    expect(refresh).not.toHaveBeenCalled();
  });

  it("links a task page to itself without a dialog", () => {
    render(
      <OnTaskPage taskKey="T-1">
        <TaskLink href="/tasks/T-1">T-1</TaskLink>
      </OnTaskPage>,
    );

    expect(screen.getByRole("link", { name: "T-1" })).toHaveAttribute(
      "href",
      "/tasks/T-1",
    );
  });

  it("loads the new task form as a full page from a task page", () => {
    render(
      <OnTaskPage taskKey="T-1">
        <TaskLink href="/tasks/new?parent=T-1">Add sub-task</TaskLink>
      </OnTaskPage>,
    );

    expect(routed("Add sub-task")).toBe(false);
  });

  it("goes through the router elsewhere, so the task opens as a dialog", () => {
    render(<TaskLink href="/tasks/T-2">T-2</TaskLink>);

    expect(screen.getByRole("link", { name: "T-2" })).toHaveAttribute(
      "href",
      "/tasks/T-2",
    );
    expect(routed("T-2")).toBe(true);
  });
});

describe("OnTaskPage", () => {
  it("refreshes when Back or Forward returns to the same task page", () => {
    window.history.replaceState(null, "", "/tasks/T-1");
    render(
      <OnTaskPage taskKey="T-1">
        <p>T-1</p>
      </OnTaskPage>,
    );

    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(refresh).toHaveBeenCalledOnce();

    window.history.replaceState(null, "", "/tasks");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(refresh).toHaveBeenCalledOnce();
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
