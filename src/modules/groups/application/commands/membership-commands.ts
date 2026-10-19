import {
  groupNotFound,
  type Group,
  type GroupError,
  type GroupRepository,
  type Person,
  type Role,
} from "@/modules/groups/domain";
import type { Command, CommandHandler } from "@/shared/application";
import { err, type Result } from "@/shared/domain";

type MembershipCommand<TType extends string> = Command<TType, GroupError> & {
  readonly groupId: string;
  readonly by: Person;
};

export type InviteMemberCommand = MembershipCommand<"groups.invite-member"> & {
  readonly login: string;
};

export type AcceptInvitationCommand =
  MembershipCommand<"groups.accept-invitation">;

export type DeclineInvitationCommand =
  MembershipCommand<"groups.decline-invitation">;

export type CancelInvitationCommand =
  MembershipCommand<"groups.cancel-invitation"> & {
    readonly login: string;
  };

export type ChangeMemberRoleCommand =
  MembershipCommand<"groups.change-member-role"> & {
    readonly userId: string;
    readonly role: Role;
  };

/** Removing yourself is leaving. */
export type RemoveMemberCommand = MembershipCommand<"groups.remove-member"> & {
  readonly userId: string;
};

type Change<TCommand> = (
  group: Group,
  command: TCommand,
  now: Date,
) => Result<void, GroupError>;

class MembershipHandler<TCommand extends MembershipCommand<string>> {
  constructor(
    private readonly groups: GroupRepository,
    private readonly clock: () => Date,
    private readonly change: Change<TCommand>,
    private readonly forInvitees = false,
  ) {}

  async handle(command: TCommand): Promise<Result<void, GroupError>> {
    const group = await this.groups.findById(command.groupId);
    const invited = group?.state.invitations.some(
      (invitation) =>
        invitation.login.toLowerCase() === command.by.login.toLowerCase(),
    );
    // Someone outside learns nothing about the group, not even that it
    // exists, unless they hold an invitation to it.
    if (
      !group ||
      !(group.memberOf(command.by.id) || (this.forInvitees && invited))
    ) {
      return err(groupNotFound());
    }
    const changed = this.change(group, command, this.clock());
    if (!changed.ok) return changed;
    return this.groups.save(group);
  }
}

export class InviteMemberHandler
  extends MembershipHandler<InviteMemberCommand>
  implements CommandHandler<InviteMemberCommand>
{
  constructor(groups: GroupRepository, clock: () => Date) {
    super(groups, clock, (group, command, now) =>
      group.invite(command.by, command.login, now),
    );
  }
}

export class AcceptInvitationHandler
  extends MembershipHandler<AcceptInvitationCommand>
  implements CommandHandler<AcceptInvitationCommand>
{
  constructor(groups: GroupRepository, clock: () => Date) {
    super(
      groups,
      clock,
      (group, command, now) => group.accept(command.by, now),
      true,
    );
  }
}

export class DeclineInvitationHandler
  extends MembershipHandler<DeclineInvitationCommand>
  implements CommandHandler<DeclineInvitationCommand>
{
  constructor(groups: GroupRepository, clock: () => Date) {
    super(groups, clock, (group, command) => group.decline(command.by), true);
  }
}

export class CancelInvitationHandler
  extends MembershipHandler<CancelInvitationCommand>
  implements CommandHandler<CancelInvitationCommand>
{
  constructor(groups: GroupRepository, clock: () => Date) {
    super(groups, clock, (group, command) =>
      group.cancelInvitation(command.by, command.login),
    );
  }
}

export class ChangeMemberRoleHandler
  extends MembershipHandler<ChangeMemberRoleCommand>
  implements CommandHandler<ChangeMemberRoleCommand>
{
  constructor(groups: GroupRepository, clock: () => Date) {
    super(groups, clock, (group, command) =>
      group.changeRole(command.by, command.userId, command.role),
    );
  }
}

export class RemoveMemberHandler
  extends MembershipHandler<RemoveMemberCommand>
  implements CommandHandler<RemoveMemberCommand>
{
  constructor(groups: GroupRepository, clock: () => Date) {
    super(groups, clock, (group, command, now) =>
      group.remove(command.by, command.userId, now),
    );
  }
}
