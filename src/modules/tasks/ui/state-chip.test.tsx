import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { TaskState } from "@/modules/tasks/application/queries/read-models";

import { StateChip } from "./state-chip";

const STATES: readonly TaskState[] = [
  "backlog",
  "ready",
  "waiting",
  "blocked",
  "running",
  "paused",
  "in-review",
  "done",
  "cancelled",
];

function colourOf(state: TaskState): string {
  const { unmount } = render(<StateChip state={state} />);
  const colour = screen
    .getByText(state)
    .className.split(" ")
    .find((name) => name.startsWith("text-state-"));
  unmount();
  return colour ?? "";
}

describe("StateChip", () => {
  it("gives every state its own colour", () => {
    const colours = STATES.map(colourOf);
    expect(colours.every(Boolean)).toBe(true);
    expect(new Set(colours).size).toBe(STATES.length);
  });
});
