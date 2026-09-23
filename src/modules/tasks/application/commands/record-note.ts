import type {
  NoteKind,
  TaskError,
  TaskRepository,
} from "@/modules/tasks/domain";
import type { CommandHandler } from "@/shared/application";
import type { Result } from "@/shared/domain";

import {
  changeTask,
  type TaskCommand,
  type TaskReference,
} from "./task-commands";

/** Append a note, decision, discovery or question to a task's journal. */
export type RecordNoteCommand = TaskCommand<"tasks.record-note"> & {
  readonly task: TaskReference;
  readonly kind: NoteKind;
  readonly text: string;
};

export class RecordNoteHandler implements CommandHandler<RecordNoteCommand> {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly clock: () => Date,
  ) {}

  handle(command: RecordNoteCommand): Promise<Result<void, TaskError>> {
    return changeTask(this.tasks, command.ownerId, command.task, (task) =>
      task.note(command.kind, command.text, command.actor, this.clock()),
    );
  }
}
