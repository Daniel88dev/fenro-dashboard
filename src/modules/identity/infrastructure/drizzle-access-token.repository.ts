import { desc, eq } from "drizzle-orm";

import {
  AccessToken,
  isAccessScope,
  type AccessTokenRepository,
} from "@/modules/identity/domain";
import { UniqueId } from "@/shared/domain";
import type { Database } from "@/shared/infrastructure/database/client";

import { agentAccessToken } from "./persistence/schema";

type Row = typeof agentAccessToken.$inferSelect;

export class DrizzleAccessTokenRepository implements AccessTokenRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<AccessToken | undefined> {
    const [row] = await this.db
      .select()
      .from(agentAccessToken)
      .where(eq(agentAccessToken.id, id));
    return row ? restore(row) : undefined;
  }

  async findBySecretHash(secretHash: string): Promise<AccessToken | undefined> {
    const [row] = await this.db
      .select()
      .from(agentAccessToken)
      .where(eq(agentAccessToken.secretHash, secretHash));
    return row ? restore(row) : undefined;
  }

  async listFor(ownerId: string): Promise<AccessToken[]> {
    const rows = await this.db
      .select()
      .from(agentAccessToken)
      .where(eq(agentAccessToken.ownerId, ownerId))
      .orderBy(desc(agentAccessToken.createdAt));
    return rows.map(restore);
  }

  async save(token: AccessToken): Promise<void> {
    const values = {
      id: token.id.value,
      ownerId: token.ownerId,
      name: token.name,
      secretHash: token.secretHash,
      hint: token.hint,
      scopes: [...token.scopes],
      createdAt: token.createdAt,
      expiresAt: token.expiresAt,
      lastUsedAt: token.lastUsedAt,
      revokedAt: token.revokedAt,
    };
    // Last write wins: the only changes after issue are a revocation and a
    // last-used time, and a revocation is never undone.
    await this.db
      .insert(agentAccessToken)
      .values(values)
      .onConflictDoUpdate({
        target: agentAccessToken.id,
        set: { lastUsedAt: values.lastUsedAt, revokedAt: values.revokedAt },
      });
    token.pullDomainEvents();
  }
}

function restore(row: Row): AccessToken {
  return AccessToken.restore(
    UniqueId.create(row.id),
    {
      ownerId: row.ownerId,
      name: row.name,
      scopes: row.scopes.filter(isAccessScope),
      secretHash: row.secretHash,
      hint: row.hint,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
    },
    { lastUsedAt: row.lastUsedAt, revokedAt: row.revokedAt },
  );
}
