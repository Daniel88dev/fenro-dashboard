import type { TaskState } from "@/modules/tasks/application/queries/read-models";

const STATE_CLASSES: Record<TaskState, string> = {
  backlog: "border-state-backlog-line text-state-backlog border-dashed",
  ready: "bg-state-ready-wash text-state-ready",
  waiting: "bg-state-waiting-wash text-state-waiting",
  blocked: "bg-state-blocked-wash text-state-blocked",
  running: "bg-state-running-wash text-state-running",
  paused: "bg-state-paused-wash text-state-paused",
  "in-review": "bg-state-review-wash text-state-review",
  done: "bg-state-done-wash text-state-done",
  cancelled: "bg-state-cancelled-wash text-state-cancelled line-through",
};

export function StateChip({ state }: { state: TaskState }) {
  return (
    <span
      data-state={state}
      className={`shrink-0 rounded-md border border-transparent px-[7px] py-px text-[11px] font-medium whitespace-nowrap ${STATE_CLASSES[state]}`}
    >
      {state}
    </span>
  );
}
