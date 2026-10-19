import type {
  InvitationRecord,
  GroupDetailRecord,
  GroupReadStore,
  GroupSummaryRecord,
} from "@/modules/groups/application/ports/group-read-store";
import {
  Group,
  groupError,
  prefixTaken,
  sameLogin,
  type GroupError,
  type GroupRepository,
  type GroupState,
} from "@/modules/groups/domain";
import { err, ok, UniqueId, type Result } from "@/shared/domain";

type Stored = {
  readonly id: string;
  readonly prefix: string;
  readonly createdAt: Date;
  readonly state: GroupState;
  readonly version: number;
};

export class InMemoryGroupStore implements GroupRepository, GroupReadStore {
  readonly #rows = new Map<string, Stored>();
  readonly #loadedVersions = new WeakMap<Group, number>();

  async findById(id: string): Promise<Group | undefined> {
    const row = this.#rows.get(id);
    return row ? this.#restore(row) : undefined;
  }

  async findByPrefix(prefix: string): Promise<Group | undefined> {
    const row = this.#withPrefix(prefix);
    return row ? this.#restore(row) : undefined;
  }

  async save(group: Group): Promise<Result<void, GroupError>> {
    const id = group.id.value;
    const holder = this.#withPrefix(group.prefix);
    if (holder && holder.id !== id) return err(prefixTaken(group.prefix));
    const current = this.#rows.get(id);
    const loaded = this.#loadedVersions.get(group);
    if (current?.version !== loaded) {
      return err(
        groupError(
          "concurrent-modification",
          `${group.name} changed while this was being saved. Try again.`,
        ),
      );
    }
    const version = (loaded ?? 0) + 1;
    this.#rows.set(id, {
      id,
      prefix: group.prefix,
      createdAt: group.createdAt,
      state: group.state,
      version,
    });
    this.#loadedVersions.set(group, version);
    group.pullDomainEvents();
    return ok(undefined);
  }

  async remove(group: Group): Promise<void> {
    this.#rows.delete(group.id.value);
  }

  async ofMember(userId: string): Promise<GroupSummaryRecord[]> {
    return [...this.#rows.values()]
      .flatMap((row) => {
        const member = row.state.members.find(
          (other) => other.userId === userId,
        );
        return member
          ? [
              {
                id: row.id,
                name: row.state.name,
                prefix: row.prefix,
                role: member.role,
                members: row.state.members.length,
              },
            ]
          : [];
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async invitationsFor(login: string): Promise<InvitationRecord[]> {
    return [...this.#rows.values()].flatMap((row) =>
      row.state.invitations
        .filter((invitation) => sameLogin(invitation.login, login))
        .map((invitation) => ({
          groupId: row.id,
          name: row.state.name,
          prefix: row.prefix,
          invitedByLogin: invitation.invitedBy.login,
          invitedAt: invitation.invitedAt,
          members: row.state.members.length,
        })),
    );
  }

  async detail(prefix: string): Promise<GroupDetailRecord | undefined> {
    const row = this.#withPrefix(prefix);
    if (!row) return undefined;
    return {
      id: row.id,
      name: row.state.name,
      prefix: row.prefix,
      createdAt: row.createdAt,
      members: row.state.members,
      invitations: row.state.invitations.map((invitation) => ({
        login: invitation.login,
        invitedByLogin: invitation.invitedBy.login,
        invitedAt: invitation.invitedAt,
      })),
    };
  }

  #withPrefix(prefix: string): Stored | undefined {
    const wanted = prefix.toUpperCase();
    return [...this.#rows.values()].find((row) => row.prefix === wanted);
  }

  #restore(row: Stored): Group {
    const group = Group.restore(
      UniqueId.create(row.id),
      { prefix: row.prefix, createdAt: row.createdAt },
      row.state,
    );
    this.#loadedVersions.set(group, row.version);
    return group;
  }
}
