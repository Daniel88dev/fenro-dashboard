import type { Result } from "@/shared/domain";

import type { TaskError } from "./errors";
import type { Label } from "./label";

/** Where a person's labels are kept. Every lookup is scoped to its owner. */
export interface LabelRepository {
  /** Every one of the owner's labels: a catalogue is short. */
  all(ownerId: string): Promise<Label[]>;

  findByName(ownerId: string, name: string): Promise<Label | undefined>;

  /**
   * Whether any of the owner's tasks or skills carries the name, catalogued
   * or not: labels written before the catalogue existed are only on tasks.
   */
  inUse(ownerId: string, name: string): Promise<boolean>;

  /** Fails with `label-exists` when the owner has a label of that name. */
  save(label: Label): Promise<Result<void, TaskError>>;

  /**
   * Write a loaded label's changes. A rename reaches every task and skill
   * carrying the old name in the same transaction, so no link drops; it fails
   * with `label-exists` when the new name is taken.
   */
  update(label: Label): Promise<Result<void, TaskError>>;
}
