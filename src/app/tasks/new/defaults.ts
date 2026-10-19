import type { NewTaskDefaults } from "@/modules/tasks/ui/task-forms";

type Params = Record<string, string | string[] | undefined>;

export function newTaskDefaults(params: Params): NewTaskDefaults {
  const one = (value: string | string[] | undefined) =>
    (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
  const source = one(params.from);
  const pullRequest = /\/pull\/(\d+)$/.exec(source);
  return {
    ...(one(params.type) === "epic" ? { kind: "epic" as const } : {}),
    repository: one(params.repository),
    parent: one(params.parent),
    source,
    space: one(params.space).toUpperCase(),
    title:
      one(params.title) ||
      (pullRequest ? `Get pull request #${pullRequest[1]} merged` : ""),
  };
}
