import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { fenro } from "@/shared/infrastructure/database/schema";

/**
 * Members are the identity context's user ids, deliberately not foreign keys:
 * the contexts share a database, not a schema.
 */
const instant = (name: string) => timestamp(name, { withTimezone: true });

export const group = fenro.table(
  "user_group",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    keyPrefix: text("key_prefix").notNull(),
    createdAt: instant("created_at").notNull(),
    version: integer("version").notNull(),
  },
  (table) => [uniqueIndex("user_group_key_prefix_idx").on(table.keyPrefix)],
);

const groupId = () =>
  text("group_id")
    .notNull()
    .references(() => group.id, { onDelete: "cascade" });

export const groupMember = fenro.table(
  "group_member",
  {
    groupId: groupId(),
    userId: text("user_id").notNull(),
    login: text("login").notNull(),
    role: text("role").notNull(),
    joinedAt: instant("joined_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.userId] }),
    index("group_member_user_idx").on(table.userId),
  ],
);

/** Logins are stored in lower case: GitHub compares them that way. */
export const groupInvitation = fenro.table(
  "group_invitation",
  {
    groupId: groupId(),
    login: text("login").notNull(),
    invitedById: text("invited_by_id").notNull(),
    invitedByLogin: text("invited_by_login").notNull(),
    invitedAt: instant("invited_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.groupId, table.login] }),
    index("group_invitation_login_idx").on(sql`lower(${table.login})`),
  ],
);
