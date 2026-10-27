import {
  ExternalReference,
  RepositoryReference,
  Task,
  taskError,
  type ExternalReference as Reference,
  type LabelRepository,
  type Priority,
  type TaskError,
  type TaskKind,
  type TaskRepository,
} from "@/modules/tasks/domain";
import type { CommandHandler } from "@/shared/application";
import { err, ok, type Result } from "@/shared/domain";

import { NO_MEMBERS, type SpaceMembers } from "../ports/space-members";
import { ensureLabels } from "./create-label";
import {
  findTask,
  type TaskCommand,
  type TaskReference,
} from "./task-commands";

export type ReferenceInput = {
  readonly url: string;
  readonly title?: string | null;
  readonly isSource?: boolean;
};

export type CreateTaskCommand = TaskCommand<"tasks.create-task"> & {
  readonly taskId: string;
  /** The space's prefix; a personal task can leave it out. */
  readonly keyPrefix?: string;
  readonly kind?: TaskKind;
  readonly title: string;
  readonly description?: string;
  readonly status?: "backlog" | "todo";
  readonly priority?: Priority;
  readonly labels?: readonly string[];
  readonly repository?: string | null;
  /** A member's GitHub login; only a group task takes one. */
  readonly assignee?: string | null;
  readonly parent?: TaskReference | null;
  readonly criteria?: readonly string[];
  readonly references?: readonly ReferenceInput[];
  readonly blockedBy?: readonly TaskReference[];
  readonly relatesTo?: readonly TaskReference[];
  readonly discoveredFrom?: TaskReference | null;
};

const ATTEMPTS = 3;

export class CreateTaskHandler implements CommandHandler<CreateTaskCommand> {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly labels: LabelRepository,
    private readonly clock: () => Date,
    private readonly members: SpaceMembers = NO_MEMBERS,
  ) {}

  async handle(command: CreateTaskCommand): Promise<Result<void, TaskError>> {
    const { ownerId } = command;

    const references = parseReferences(command.references ?? []);
    if (!references.ok) return references;

    const parent = command.parent
      ? await findTask(this.tasks, ownerId, command.parent)
      : undefined;
    if (parent && !parent.ok) return parent;

    let repository: RepositoryReference | null =
      parent?.value.state.repository ?? null;
    if (command.repository) {
      const parsed = RepositoryReference.parse(command.repository);
      if (!parsed.ok) return parsed;
      repository = parsed.value;
    }

    const links = await this.#resolveLinks(command);
    if (!links.ok) return links;

    const members =
      command.assignee && command.keyPrefix
        ? await this.members.of(ownerId, command.keyPrefix)
        : [];

    let last: TaskError | undefined;
    for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
      const now = this.clock();
      const created = Task.create({
        id: command.taskId,
        ownerId,
        keyPrefix: command.keyPrefix,
        number: await this.tasks.nextNumber(ownerId),
        kind: command.kind,
        title: command.title,
        description: command.description,
        status: command.status,
        priority: command.priority,
        labels: command.labels,
        repository,
        parentId: parent?.value.id.value ?? null,
        criteria: command.criteria,
        references: references.value,
        author: command.actor,
        now,
      });
      if (!created.ok) return created;
      const task = created.value;
      if (command.assignee) {
        const assigned = task.assign(
          command.assignee,
          members,
          command.actor,
          now,
        );
        if (!assigned.ok) return assigned;
      }

      const graph = (await this.tasks.graph(ownerId)).with({
        id: task.id.value,
        number: task.number,
        status: task.status,
        parentId: task.parentId,
        blockedBy: [],
      });
      for (const link of links.value) {
        if (
          link.kind === "blocked-by" &&
          graph.wouldCycleByBlocking(task.id.value, link.taskId)
        ) {
          return err(
            taskError(
              "dependency-cycle",
              `A task cannot be blocked by ${link.key}: it would wait on itself, because ${link.key} is its parent or waits on it. Leave the link out.`,
            ),
          );
        }
        const linked = task.link(link.kind, link.taskId, command.actor, now);
        if (!linked.ok) return linked;
      }

      const labelled = await ensureLabels(
        this.labels,
        ownerId,
        task.state.labels,
        now,
      );
      if (!labelled.ok) return labelled;

      const saved = await this.tasks.save(task);
      if (saved.ok || saved.error.code !== "concurrent-modification") {
        return saved;
      }
      last = saved.error;
    }
    return err(last!);
  }

  async #resolveLinks(command: CreateTaskCommand) {
    const wanted = [
      ...(command.blockedBy ?? []).map((reference) => ({
        kind: "blocked-by" as const,
        reference,
      })),
      ...(command.relatesTo ?? []).map((reference) => ({
        kind: "relates-to" as const,
        reference,
      })),
      ...(command.discoveredFrom
        ? [
            {
              kind: "discovered-from" as const,
              reference: command.discoveredFrom,
            },
          ]
        : []),
    ];

    const links: {
      kind: (typeof wanted)[number]["kind"];
      taskId: string;
      key: string;
    }[] = [];
    for (const { kind, reference } of wanted) {
      const found = await findTask(this.tasks, command.ownerId, reference);
      if (!found.ok) return found;
      links.push({ kind, taskId: found.value.id.value, key: found.value.key });
    }
    return ok(links);
  }
}

export function parseReferences(
  inputs: readonly ReferenceInput[],
): Result<Reference[], TaskError> {
  const references: Reference[] = [];
  for (const input of inputs) {
    const reference = ExternalReference.fromUrl(input.url, input);
    if (!reference.ok) return reference;
    references.push(reference.value);
  }
  return ok(references);
}
