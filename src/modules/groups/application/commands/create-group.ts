import {
  Group,
  parseKeyPrefix,
  prefixTaken,
  type GroupError,
  type GroupRepository,
  type Person,
} from "@/modules/groups/domain";
import type { Command, CommandHandler } from "@/shared/application";
import { err, type Result } from "@/shared/domain";

export type CreateGroupCommand = Command<"groups.create-group", GroupError> & {
  readonly groupId: string;
  readonly name: string;
  readonly prefix: string;
  readonly by: Person;
};

export function createGroupCommand(
  input: Omit<CreateGroupCommand, "type" | "__refusal">,
): CreateGroupCommand {
  return { type: "groups.create-group", ...input };
}

export class CreateGroupHandler implements CommandHandler<CreateGroupCommand> {
  constructor(
    private readonly groups: GroupRepository,
    private readonly clock: () => Date,
  ) {}

  async handle(command: CreateGroupCommand): Promise<Result<void, GroupError>> {
    const prefix = parseKeyPrefix(command.prefix);
    if (!prefix.ok) return prefix;
    if (await this.groups.findByPrefix(prefix.value)) {
      return err(prefixTaken(prefix.value));
    }
    const created = Group.create({
      id: command.groupId,
      name: command.name,
      prefix: prefix.value,
      owner: command.by,
      now: this.clock(),
    });
    if (!created.ok) return created;
    return this.groups.save(created.value);
  }
}
