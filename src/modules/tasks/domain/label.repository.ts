import type { Result } from "@/shared/domain";

import type { TaskError } from "./errors";
import type { Label } from "./label";

/** Where a person's labels are kept. Every lookup is scoped to its owner. */
export interface LabelRepository {
  /** The owner's labels with these (already normalised) names. */
  named(ownerId: string, names: readonly string[]): Promise<Label[]>;

  /** Fails with `label-exists` when the owner has a label of that name. */
  save(label: Label): Promise<Result<void, TaskError>>;
}
