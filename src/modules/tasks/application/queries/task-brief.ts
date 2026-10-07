import {
  parseTaskKey,
  taskNotFound,
  type TaskError,
} from "@/modules/tasks/domain";
import type { Query, QueryHandler } from "@/shared/application";
import { err, ok, type Result } from "@/shared/domain";

import type { TaskReadStore } from "../ports/task-read-store";
import { brief, briefSkills, TaskIndex } from "./projections";
import type { TaskBrief } from "./read-models";

export type TaskBriefResult = Result<TaskBrief, TaskError>;

/** Everything a session needs to pick up one task, named by key or id. */
export type TaskBriefQuery = Query<"tasks.task-brief", TaskBriefResult> & {
  readonly ownerId: string;
  readonly task: string;
  /** How many of the latest journal entries to include. */
  readonly journalLimit?: number;
  /**
   * Whether the skills that apply carry their instructions, or only their
   * name, description and labels. Starting work wants them; looking around
   * does not. Off unless asked for.
   */
  readonly skillInstructions?: boolean;
};

export function taskBriefQuery(
  ownerId: string,
  task: string,
  journalLimit?: number,
  options: { readonly skillInstructions?: boolean } = {},
): TaskBriefQuery {
  return {
    type: "tasks.task-brief",
    ownerId,
    task,
    journalLimit,
    skillInstructions: options.skillInstructions,
  };
}

export class TaskBriefHandler implements QueryHandler<
  TaskBriefQuery,
  TaskBriefResult
> {
  constructor(
    private readonly tasks: TaskReadStore,
    private readonly clock: () => Date,
  ) {}

  async handle(query: TaskBriefQuery): Promise<TaskBriefResult> {
    const now = this.clock();
    const index = new TaskIndex(await this.tasks.records(query.ownerId), now);

    const reference = query.task.trim();
    const byId = index.get(reference.toLowerCase());
    let id = byId?.id;
    if (!id) {
      const number = parseTaskKey(reference);
      if (!number.ok) return number;
      id = index.records.find((record) => record.number === number.value)?.id;
    }

    const detail = id ? await this.tasks.detail(query.ownerId, id) : undefined;
    if (!detail) return err(taskNotFound(reference));
    const skills =
      detail.labels.length > 0
        ? await this.tasks.skillsLinkedTo(query.ownerId, detail.labels)
        : [];
    return ok(
      brief(
        detail,
        index,
        now,
        query.journalLimit,
        briefSkills(detail.labels, skills, query.skillInstructions ?? false),
      ),
    );
  }
}
