import type { Result } from "@/shared/domain";

import type { TaskError } from "./errors";
import type { Label } from "./label";

export interface LabelRepository {
  all(ownerId: string): Promise<Label[]>;

  findByName(ownerId: string, name: string): Promise<Label | undefined>;

  /**
   * Catalogued or not: labels written before the catalogue existed are only
   * on tasks.
   */
  inUse(ownerId: string, name: string): Promise<boolean>;

  save(label: Label): Promise<Result<void, TaskError>>;

  /**
   * A rename reaches every task and skill carrying the old name in the same
   * transaction, so no link drops.
   */
  update(label: Label): Promise<Result<void, TaskError>>;
}
