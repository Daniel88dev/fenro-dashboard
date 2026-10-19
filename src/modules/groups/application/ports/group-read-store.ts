import type { Role } from "@/modules/groups/domain";

export interface GroupReadStore {
  ofMember(userId: string): Promise<GroupSummaryRecord[]>;
  invitationsFor(login: string): Promise<InvitationRecord[]>;
  detail(prefix: string): Promise<GroupDetailRecord | undefined>;
}

export type GroupSummaryRecord = {
  readonly id: string;
  readonly name: string;
  readonly prefix: string;
  readonly role: Role;
  readonly members: number;
};

export type InvitationRecord = {
  readonly groupId: string;
  readonly name: string;
  readonly prefix: string;
  readonly invitedByLogin: string;
  readonly invitedAt: Date;
  readonly members: number;
};

export type GroupDetailRecord = {
  readonly id: string;
  readonly name: string;
  readonly prefix: string;
  readonly createdAt: Date;
  readonly members: readonly {
    readonly userId: string;
    readonly login: string;
    readonly role: Role;
    readonly joinedAt: Date;
  }[];
  readonly invitations: readonly {
    readonly login: string;
    readonly invitedByLogin: string;
    readonly invitedAt: Date;
  }[];
};
