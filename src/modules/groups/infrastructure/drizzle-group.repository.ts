import { and, asc, count, eq, inArray, sql } from "drizzle-orm";

import type {
  InvitationRecord,
  GroupDetailRecord,
  GroupReadStore,
  GroupSummaryRecord,
} from "@/modules/groups/application/ports/group-read-store";
import {
  isRole,
  Group,
  groupError,
  prefixTaken,
  type GroupError,
  type GroupRepository,
  type Role,
} from "@/modules/groups/domain";
import { err, ok, UniqueId, type Result } from "@/shared/domain";
import type { Database } from "@/shared/infrastructure/database/client";
import { isUniqueViolation } from "@/shared/infrastructure/database/unique-violation";

import {
  group as groupTable,
  groupInvitation,
  groupMember,
} from "./persistence/schema";

type GroupRow = typeof groupTable.$inferSelect;

const roleOf = (value: string): Role => (isRole(value) ? value : "member");

export class DrizzleGroupRepository implements GroupRepository {
  readonly #loadedVersions = new WeakMap<Group, number>();

  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Group | undefined> {
    const [row] = await this.db
      .select()
      .from(groupTable)
      .where(eq(groupTable.id, id));
    return row ? this.#restore(row) : undefined;
  }

  async findByPrefix(prefix: string): Promise<Group | undefined> {
    const [row] = await this.db
      .select()
      .from(groupTable)
      .where(eq(groupTable.keyPrefix, prefix.toUpperCase()));
    return row ? this.#restore(row) : undefined;
  }

  async save(group: Group): Promise<Result<void, GroupError>> {
    const loaded = this.#loadedVersions.get(group);
    const { state } = group;
    const id = group.id.value;
    let version: number | undefined;
    try {
      version = await this.db.transaction(async (tx) => {
        const values = {
          id,
          name: state.name,
          keyPrefix: group.prefix,
          createdAt: group.createdAt,
        };
        const [saved] =
          loaded === undefined
            ? await tx
                .insert(groupTable)
                .values({ ...values, version: 1 })
                .onConflictDoNothing({ target: groupTable.id })
                .returning({ version: groupTable.version })
            : await tx
                .update(groupTable)
                .set({ name: values.name, version: loaded + 1 })
                .where(
                  and(eq(groupTable.id, id), eq(groupTable.version, loaded)),
                )
                .returning({ version: groupTable.version });
        if (!saved) return undefined;

        await tx.delete(groupMember).where(eq(groupMember.groupId, id));
        await tx.delete(groupInvitation).where(eq(groupInvitation.groupId, id));
        if (state.members.length > 0) {
          await tx.insert(groupMember).values(
            state.members.map((member) => ({
              groupId: id,
              userId: member.userId,
              login: member.login,
              role: member.role,
              joinedAt: member.joinedAt,
            })),
          );
        }
        if (state.invitations.length > 0) {
          await tx.insert(groupInvitation).values(
            state.invitations.map((invitation) => ({
              groupId: id,
              login: invitation.login.toLowerCase(),
              invitedById: invitation.invitedBy.id,
              invitedByLogin: invitation.invitedBy.login,
              invitedAt: invitation.invitedAt,
            })),
          );
        }
        return saved.version;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return err(prefixTaken(group.prefix));
      }
      throw error;
    }

    if (version === undefined) {
      return err(
        groupError(
          "concurrent-modification",
          `${state.name} changed while this was being saved. Try again.`,
        ),
      );
    }
    this.#loadedVersions.set(group, version);
    group.pullDomainEvents();
    return ok(undefined);
  }

  async remove(group: Group): Promise<void> {
    await this.db.delete(groupTable).where(eq(groupTable.id, group.id.value));
  }

  async #restore(row: GroupRow): Promise<Group> {
    const [members, invitations] = await Promise.all([
      this.db
        .select()
        .from(groupMember)
        .where(eq(groupMember.groupId, row.id))
        .orderBy(asc(groupMember.joinedAt)),
      this.db
        .select()
        .from(groupInvitation)
        .where(eq(groupInvitation.groupId, row.id))
        .orderBy(asc(groupInvitation.invitedAt)),
    ]);
    const group = Group.restore(
      UniqueId.create(row.id),
      { prefix: row.keyPrefix, createdAt: row.createdAt },
      {
        name: row.name,
        members: members.map((member) => ({
          userId: member.userId,
          login: member.login,
          role: roleOf(member.role),
          joinedAt: member.joinedAt,
        })),
        invitations: invitations.map((invitation) => ({
          login: invitation.login,
          invitedBy: {
            id: invitation.invitedById,
            login: invitation.invitedByLogin,
          },
          invitedAt: invitation.invitedAt,
        })),
      },
    );
    this.#loadedVersions.set(group, row.version);
    return group;
  }
}

export class DrizzleGroupReadStore implements GroupReadStore {
  constructor(private readonly db: Database) {}

  async ofMember(userId: string): Promise<GroupSummaryRecord[]> {
    const rows = await this.db
      .select({
        id: groupTable.id,
        name: groupTable.name,
        prefix: groupTable.keyPrefix,
        role: groupMember.role,
      })
      .from(groupMember)
      .innerJoin(groupTable, eq(groupTable.id, groupMember.groupId))
      .where(eq(groupMember.userId, userId))
      .orderBy(asc(groupTable.name));
    const members = await this.#memberCounts(rows.map((row) => row.id));
    return rows.map((row) => ({
      ...row,
      role: roleOf(row.role),
      members: members.get(row.id) ?? 0,
    }));
  }

  async invitationsFor(login: string): Promise<InvitationRecord[]> {
    const rows = await this.db
      .select({
        groupId: groupTable.id,
        name: groupTable.name,
        prefix: groupTable.keyPrefix,
        invitedByLogin: groupInvitation.invitedByLogin,
        invitedAt: groupInvitation.invitedAt,
      })
      .from(groupInvitation)
      .innerJoin(groupTable, eq(groupTable.id, groupInvitation.groupId))
      .where(eq(sql`lower(${groupInvitation.login})`, login.toLowerCase()))
      .orderBy(asc(groupInvitation.invitedAt));
    const members = await this.#memberCounts(rows.map((row) => row.groupId));
    return rows.map((row) => ({
      ...row,
      members: members.get(row.groupId) ?? 0,
    }));
  }

  async detail(prefix: string): Promise<GroupDetailRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(groupTable)
      .where(eq(groupTable.keyPrefix, prefix.toUpperCase()));
    if (!row) return undefined;
    const [members, invitations] = await Promise.all([
      this.db
        .select()
        .from(groupMember)
        .where(eq(groupMember.groupId, row.id))
        .orderBy(asc(groupMember.joinedAt)),
      this.db
        .select()
        .from(groupInvitation)
        .where(eq(groupInvitation.groupId, row.id))
        .orderBy(asc(groupInvitation.invitedAt)),
    ]);
    return {
      id: row.id,
      name: row.name,
      prefix: row.keyPrefix,
      createdAt: row.createdAt,
      members: members.map((member) => ({
        userId: member.userId,
        login: member.login,
        role: roleOf(member.role),
        joinedAt: member.joinedAt,
      })),
      invitations: invitations.map((invitation) => ({
        login: invitation.login,
        invitedByLogin: invitation.invitedByLogin,
        invitedAt: invitation.invitedAt,
      })),
    };
  }

  async #memberCounts(ids: readonly string[]): Promise<Map<string, number>> {
    if (ids.length === 0) return new Map();
    const rows = await this.db
      .select({
        id: groupMember.groupId,
        members: count(),
      })
      .from(groupMember)
      .where(inArray(groupMember.groupId, [...ids]))
      .groupBy(groupMember.groupId);
    return new Map(rows.map((row) => [row.id, Number(row.members)]));
  }
}
