import type { Tone } from "@/modules/github-insights/ui/chip";
import type { TaskState } from "@/modules/tasks/application/queries/read-models";

/** A task's state chip means the same thing on every screen. */
export const STATE_TONES: Record<TaskState, Tone> = {
  running: "healthy",
  "in-review": "healthy",
  blocked: "attention",
  paused: "neutral",
  ready: "neutral",
  waiting: "neutral",
  backlog: "neutral",
  done: "neutral",
  cancelled: "neutral",
};

export function taskHref(key: string): string {
  return `/tasks/${key}`;
}
