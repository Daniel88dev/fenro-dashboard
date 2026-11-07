import {
  readTaskKey,
  taskNotFound,
  type TaskError,
} from "@/modules/tasks/domain";
import type { Query, QueryHandler } from "@/shared/application";
import { err, ok, type Result } from "@/shared/domain";

import type { SkillTextRecord, TaskReadStore } from "../ports/task-read-store";
import { brief, briefSkills, matchesKey, TaskIndex } from "./projections";
import type { TaskBrief } from "./read-models";

export type TaskBriefResult = Result<TaskBrief, TaskError>;

export type TaskBriefQuery = Query<"tasks.task-brief", TaskBriefResult> & {
  readonly ownerId: string;
  readonly task: string;
  readonly journalLimit?: number;
  readonly skillInstructions?: boolean;
  readonly readerId?: string;
};

export function taskBriefQuery(
  ownerId: string,
  task: string,
  journalLimit?: number,
  options: {
    readonly skillInstructions?: boolean;
    readonly readerId?: string;
  } = {},
): TaskBriefQuery {
  return {
    type: "tasks.task-brief",
    ownerId,
    task,
    journalLimit,
    skillInstructions: options.skillInstructions,
    readerId: options.readerId,
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
    const reference = query.task.trim();
    let around = await this.tasks.recordsAround(query.ownerId, {
      id: reference.toLowerCase(),
    });
    let id = around.length > 0 ? reference.toLowerCase() : undefined;
    if (!id) {
      const key = readTaskKey(reference);
      if (!key.ok) return key;
      around = await this.tasks.recordsAround(query.ownerId, {
        number: key.value.number,
      });
      id = around.find((record) => matchesKey(record, key.value))?.id;
    }
    const index = new TaskIndex(around, now);

    const detail = id ? await this.tasks.detail(query.ownerId, id) : undefined;
    if (!detail) return err(taskNotFound(reference));
    const skills =
      detail.labels.length > 0
        ? await this.skillsFor(query, detail.labels)
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

  // Skills stay personal, so a group task brings the reader's own skills for
  // its labels; on a name clash the reader's copy wins over the space's.
  private async skillsFor(
    query: TaskBriefQuery,
    labels: readonly string[],
  ): Promise<SkillTextRecord[]> {
    const { ownerId, readerId } = query;
    const own = await this.tasks.skillsLinkedTo(ownerId, labels);
    if (!readerId || readerId === ownerId) return own;
    const reader = await this.tasks.skillsLinkedTo(readerId, labels);
    const names = new Set(reader.map((skill) => skill.name));
    return [...reader, ...own.filter((skill) => !names.has(skill.name))];
  }
}
