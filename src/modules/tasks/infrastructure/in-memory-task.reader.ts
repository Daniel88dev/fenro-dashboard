import type { TaskReader } from "@/modules/tasks/application/ports/task-reader";
import type {
  RepositoryTasks,
  TaskCountsByRepository,
} from "@/modules/tasks/application/queries/read-models";

import { SAMPLE_TASKS, type SampleRepositoryTasks } from "./sample-tasks";

/** Serves the prototype's sample tasks until the `Task` aggregate exists. */
export class InMemoryTaskReader implements TaskReader {
  readonly #byFullName: Map<string, SampleRepositoryTasks>;

  constructor(tasks: readonly SampleRepositoryTasks[] = SAMPLE_TASKS) {
    this.#byFullName = new Map(
      tasks.map((entry) => [`${entry.owner}/${entry.name}`, entry]),
    );
  }

  countsByRepository(): Promise<TaskCountsByRepository> {
    const counts: Record<
      string,
      { total: number; running: number; hint: string }
    > = {};
    for (const [fullName, entry] of this.#byFullName) {
      counts[fullName] = {
        total: entry.total,
        running: entry.running,
        hint: entry.hint,
      };
    }
    return Promise.resolve(counts);
  }

  forRepository(owner: string, name: string): Promise<RepositoryTasks> {
    const entry = this.#byFullName.get(`${owner}/${name}`);
    if (!entry) {
      return Promise.resolve({
        summary: "no tasks yet",
        total: 0,
        shown: [],
      });
    }

    return Promise.resolve({
      summary: entry.summary,
      total: entry.total,
      shown: entry.tasks,
    });
  }
}
