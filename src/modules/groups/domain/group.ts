import { AggregateRoot, err, ok, UniqueId, type Result } from "@/shared/domain";

import { invalidGroup, groupError, type GroupError } from "./errors";
import { MemberJoined, MemberLeft, GroupCreated } from "./events";
import { parseGitHubLogin, sameLogin } from "./github-login";
import { parseKeyPrefix } from "./key-prefix";

export const NAME_LIMIT = 60;

export const ROLES = ["owner", "member"] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/** Someone signed in with GitHub: the user id and the login they use there. */
export type Person = {
  readonly id: string;
  readonly login: string;
};

export type Membership = {
  readonly userId: string;
  readonly login: string;
  readonly role: Role;
  readonly joinedAt: Date;
};

/**
 * Addressed to a GitHub login rather than a user, so a person can be invited
 * before they have ever signed in.
 */
export type Invitation = {
  readonly login: string;
  readonly invitedBy: Person;
  readonly invitedAt: Date;
};

type Props = {
  readonly prefix: string;
  readonly createdAt: Date;
};

export type GroupState = {
  readonly name: string;
  readonly members: readonly Membership[];
  readonly invitations: readonly Invitation[];
};

export class Group extends AggregateRoot<Props> {
  #state: GroupState;

  private constructor(id: UniqueId, props: Props, state: GroupState) {
    super(id, props);
    this.#state = state;
  }

  static create(input: {
    readonly id: string;
    readonly name: string;
    readonly prefix: string;
    readonly owner: Person;
    readonly now: Date;
  }): Result<Group, GroupError> {
    const name = checkName(input.name);
    if (!name.ok) return name;
    const prefix = parseKeyPrefix(input.prefix);
    if (!prefix.ok) return prefix;

    const group = new Group(
      UniqueId.create(input.id),
      { prefix: prefix.value, createdAt: input.now },
      {
        name: name.value,
        members: [
          {
            userId: input.owner.id,
            login: input.owner.login,
            role: "owner",
            joinedAt: input.now,
          },
        ],
        invitations: [],
      },
    );
    group.record(new GroupCreated(group.id.value, prefix.value, input.now));
    return ok(group);
  }

  static restore(id: UniqueId, props: Props, state: GroupState): Group {
    return new Group(id, props, state);
  }

  get prefix(): string {
    return this.props.prefix;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get name(): string {
    return this.#state.name;
  }

  get state(): GroupState {
    return this.#state;
  }

  memberOf(userId: string): Membership | undefined {
    return this.#state.members.find((member) => member.userId === userId);
  }

  isOwner(userId: string): boolean {
    return this.memberOf(userId)?.role === "owner";
  }

  invite(by: Person, login: string, now: Date): Result<void, GroupError> {
    const owner = this.#requireOwner(by.id, "invite people");
    if (!owner.ok) return owner;
    const parsed = parseGitHubLogin(login);
    if (!parsed.ok) return parsed;
    const wanted = parsed.value;

    if (this.#state.members.some((member) => sameLogin(member.login, wanted))) {
      return err(
        groupError(
          "already-a-member",
          `${wanted} is already a member of ${this.name}.`,
        ),
      );
    }
    if (this.#invitationFor(wanted)) {
      return err(
        groupError(
          "already-invited",
          `${wanted} is already invited to ${this.name}.`,
        ),
      );
    }
    this.#state = {
      ...this.#state,
      invitations: [
        ...this.#state.invitations,
        { login: wanted, invitedBy: by, invitedAt: now },
      ],
    };
    return ok(undefined);
  }

  accept(person: Person, now: Date): Result<void, GroupError> {
    if (!this.#invitationFor(person.login)) return err(noInvitation());
    this.#state = {
      ...this.#state,
      invitations: this.#withoutInvitation(person.login),
      members: this.memberOf(person.id)
        ? this.#state.members
        : [
            ...this.#state.members,
            {
              userId: person.id,
              login: person.login,
              role: "member",
              joinedAt: now,
            },
          ],
    };
    this.record(new MemberJoined(this.id.value, person.id, now));
    return ok(undefined);
  }

  decline(person: Person): Result<void, GroupError> {
    if (!this.#invitationFor(person.login)) return err(noInvitation());
    this.#state = {
      ...this.#state,
      invitations: this.#withoutInvitation(person.login),
    };
    return ok(undefined);
  }

  cancelInvitation(by: Person, login: string): Result<void, GroupError> {
    const owner = this.#requireOwner(by.id, "cancel an invitation");
    if (!owner.ok) return owner;
    if (!this.#invitationFor(login)) return err(noInvitation());
    this.#state = {
      ...this.#state,
      invitations: this.#withoutInvitation(login),
    };
    return ok(undefined);
  }

  changeRole(by: Person, userId: string, role: Role): Result<void, GroupError> {
    const owner = this.#requireOwner(by.id, "change roles");
    if (!owner.ok) return owner;
    const member = this.memberOf(userId);
    if (!member) return err(noMember());
    if (member.role === role) return ok(undefined);
    if (member.role === "owner" && this.#owners() === 1) {
      return err(lastOwner(`${member.login} is the only owner`));
    }
    this.#state = {
      ...this.#state,
      members: this.#state.members.map((other) =>
        other.userId === userId ? { ...other, role } : other,
      ),
    };
    return ok(undefined);
  }

  remove(by: Person, userId: string, now: Date): Result<void, GroupError> {
    if (userId === by.id) return this.leave(by, now);
    const owner = this.#requireOwner(by.id, "remove members");
    if (!owner.ok) return owner;
    if (!this.memberOf(userId)) return err(noMember());
    return this.#drop(userId, now);
  }

  leave(person: Person, now: Date): Result<void, GroupError> {
    const member = this.memberOf(person.id);
    if (!member) return err(noMember());
    if (member.role === "owner" && this.#owners() === 1) {
      return err(
        lastOwner(
          "You are the only owner. Make someone else an owner first, or delete the group",
        ),
      );
    }
    return this.#drop(person.id, now);
  }

  checkCanDelete(by: Person): Result<void, GroupError> {
    return this.#requireOwner(by.id, "delete it");
  }

  #drop(userId: string, now: Date): Result<void, GroupError> {
    this.#state = {
      ...this.#state,
      members: this.#state.members.filter((member) => member.userId !== userId),
    };
    this.record(new MemberLeft(this.id.value, userId, now));
    return ok(undefined);
  }

  #requireOwner(userId: string, what: string): Result<void, GroupError> {
    if (this.isOwner(userId)) return ok(undefined);
    return err(
      groupError("not-an-owner", `Only an owner of ${this.name} can ${what}.`),
    );
  }

  #owners(): number {
    return this.#state.members.filter((member) => member.role === "owner")
      .length;
  }

  #invitationFor(login: string): Invitation | undefined {
    return this.#state.invitations.find((invitation) =>
      sameLogin(invitation.login, login),
    );
  }

  #withoutInvitation(login: string): Invitation[] {
    return this.#state.invitations.filter(
      (invitation) => !sameLogin(invitation.login, login),
    );
  }
}

function checkName(value: string): Result<string, GroupError> {
  const name = value.trim().replace(/\s+/g, " ");
  if (!name) return err(invalidGroup("Give the group a name."));
  if (name.length > NAME_LIMIT) {
    return err(invalidGroup(`Keep the name under ${NAME_LIMIT} characters.`));
  }
  return ok(name);
}

function noInvitation(): GroupError {
  return groupError(
    "invitation-not-found",
    "That invitation is no longer open.",
  );
}

function noMember(): GroupError {
  return groupError(
    "member-not-found",
    "That person is not a member of this group.",
  );
}

function lastOwner(reason: string): GroupError {
  return groupError(
    "last-owner",
    `${reason}. A group always keeps at least one owner.`,
  );
}
