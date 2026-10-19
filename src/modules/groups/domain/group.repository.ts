import type { Result } from "@/shared/domain";

import type { GroupError } from "./errors";
import type { Group } from "./group";

export interface GroupRepository {
  findById(id: string): Promise<Group | undefined>;
  findByPrefix(prefix: string): Promise<Group | undefined>;
  /** Refuses a prefix another group already uses, as `prefix-taken`. */
  save(group: Group): Promise<Result<void, GroupError>>;
  remove(group: Group): Promise<void>;
}
