// @vitest-environment node
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  AccessToken,
  accessTokenHint,
  generateAccessTokenSecret,
  hashAccessTokenSecret,
} from "@/modules/identity/domain";
import { getEnv } from "@/shared/config/env";
import { unwrap } from "@/shared/domain";
import type { Database } from "@/shared/infrastructure/database/client";

import { DrizzleAccessTokenRepository } from "./drizzle-access-token.repository";
import { user } from "./persistence/schema";

/**
 * Runs against a real Postgres: the token is found by the hash of its secret,
 * and the revocation and last use it gains after issue must reach the row.
 */
const url = getEnv().TEST_DATABASE_URL;

const t0 = new Date("2026-09-23T10:00:00Z");
const later = (minutes: number) => new Date(t0.getTime() + minutes * 60_000);

async function aToken(
  overrides: { id?: string; ownerId?: string; name?: string; now?: Date } = {},
): Promise<{ token: AccessToken; secret: string }> {
  const secret = generateAccessTokenSecret();
  const token = unwrap(
    AccessToken.issue({
      id: overrides.id ?? crypto.randomUUID(),
      ownerId: overrides.ownerId ?? "user-1",
      name: overrides.name ?? "Claude Code on my laptop",
      scopes: ["tasks:write"],
      secretHash: await hashAccessTokenSecret(secret),
      hint: accessTokenHint(secret),
      lifetimeDays: 30,
      now: overrides.now ?? t0,
    }),
  );
  return { token, secret };
}

describe.skipIf(!url)("DrizzleAccessTokenRepository", () => {
  let pool: Pool;
  let db: Database;

  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    db = drizzle({ client: pool });
  });

  beforeEach(async () => {
    // Tokens belong to a user row, so emptying the users empties them too.
    await db.execute(sql`truncate "user" cascade`);
    await db.insert(user).values([
      { id: "user-1", name: "Daniel", email: "daniel@example.com" },
      { id: "user-2", name: "Mira", email: "mira@example.com" },
    ]);
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("saves a token and finds it by id and by the hash of its secret", async () => {
    const repository = new DrizzleAccessTokenRepository(db);
    const { token, secret } = await aToken({ id: "token-1" });
    await repository.save(token);

    const byId = await new DrizzleAccessTokenRepository(db).findById("token-1");
    const bySecret = await repository.findBySecretHash(
      await hashAccessTokenSecret(secret),
    );

    expect(byId?.id.value).toBe("token-1");
    expect(byId?.ownerId).toBe("user-1");
    expect(byId?.name).toBe("Claude Code on my laptop");
    expect(byId?.scopes).toEqual(["tasks:read", "tasks:write"]);
    expect(byId?.secretHash).toBe(token.secretHash);
    expect(byId?.hint).toBe(secret.slice(-4));
    expect(byId?.createdAt).toEqual(t0);
    expect(byId?.expiresAt).toEqual(token.expiresAt);
    expect(byId?.lastUsedAt).toBeNull();
    expect(byId?.revokedAt).toBeNull();
    expect(byId?.isUsable(later(1))).toBe(true);
    expect(bySecret?.id.value).toBe("token-1");
    expect(await repository.findById("token-2")).toBeUndefined();
    expect(await repository.findBySecretHash("0".repeat(64))).toBeUndefined();
  });

  it("lists an owner's tokens newest first, and no one else's", async () => {
    const repository = new DrizzleAccessTokenRepository(db);
    const oldest = await aToken({ id: "token-a", now: t0 });
    const newest = await aToken({ id: "token-c", now: later(20) });
    const middle = await aToken({ id: "token-b", now: later(10) });
    const theirs = await aToken({ id: "token-d", ownerId: "user-2" });
    for (const { token } of [oldest, newest, middle, theirs]) {
      await repository.save(token);
    }

    const mine = await repository.listFor("user-1");

    expect(mine.map((token) => token.id.value)).toEqual([
      "token-c",
      "token-b",
      "token-a",
    ]);
    expect(
      (await repository.listFor("user-2")).map((token) => token.id.value),
    ).toEqual(["token-d"]);
    expect(await repository.listFor("user-3")).toEqual([]);
  });

  it("keeps a token's last use and its revocation", async () => {
    const repository = new DrizzleAccessTokenRepository(db);
    const { token } = await aToken({ id: "token-1" });
    await repository.save(token);

    const loaded = (await repository.findById("token-1"))!;
    expect(loaded.recordUse(later(1))).toBe(true);
    await repository.save(loaded);
    const used = (await repository.findById("token-1"))!;
    expect(used.lastUsedAt).toEqual(later(1));
    expect(used.revokedAt).toBeNull();

    used.revoke(later(2));
    await repository.save(used);
    const revoked = (await new DrizzleAccessTokenRepository(db).findById(
      "token-1",
    ))!;

    expect(revoked.lastUsedAt).toEqual(later(1));
    expect(revoked.revokedAt).toEqual(later(2));
    expect(revoked.isUsable(later(3))).toBe(false);
  });
});
