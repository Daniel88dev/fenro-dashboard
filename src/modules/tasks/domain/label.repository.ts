import type { Result } from "@/shared/domain";

import type { TaskError } from "./errors";
import type { Label } from "./label";

/** Where a person's labels are kept. Every lookup is scoped to its owner. */
export interface LabelRepository {
  /** Every one of the owner's labels: a catalogue is short. */
  all(ownerId: string): Promise<Label[]>;

  /** Fails with `label-exists` when the owner has a label of that name. */
  save(label: Label): Promise<Result<void, TaskError>>;
}
