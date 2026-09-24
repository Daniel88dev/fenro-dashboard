import type { NewTaskDefaults } from "@/modules/tasks/ui/task-forms";

type Params = Record<string, string | string[] | undefined>;

/**
 * What the form starts with, from the query string: "New task here" passes
 * the repository, "Make a task from this" the pull request, "Add sub-task"
 * the parent. Shared by the page and the dialog.
 */
export function newTaskDefaults(params: Params): NewTaskDefaults {
  const one = (value: string | string[] | undefined) =>
    (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
  const source = one(params.from);
  const pullRequest = /\/pull\/(\d+)$/.exec(source);
  return {
    repository: one(params.repository),
    parent: one(params.parent),
    source,
    title:
      one(params.title) ||
      (pullRequest ? `Get pull request #${pullRequest[1]} merged` : ""),
  };
}
