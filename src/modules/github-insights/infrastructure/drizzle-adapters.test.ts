// @vitest-environment node
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  aPullRequest,
  aSnapshot,
  anIssue,
} from "@/modules/github-insights/application/ports/repository-snapshot.fixtures";
import {
  RepositoryCoordinates,
  WatchedRepository,
} from "@/modules/github-insights/domain";
import { getEnv } from "@/shared/config/env";
import { isErr, isOk, unwrap } from "@/shared/domain";
import type { Database } from "@/shared/infrastructure/database/client";

import { DrizzleRepositorySnapshotStore } from "./drizzle-repository-snapshot.store";
import { DrizzleWatchedRepositoryRepository } from "./drizzle-watched-repository.repository";

/**
 * Runs against a real Postgres, because what these adapters promise — the
 * case-insensitive unique watch, the version check, the all-or-nothing
 * replace — is Postgres behaviour a fake cannot prove.
 */
const url = getEnv().TEST_DATABASE_URL;

const t0 = new Date("2026-09-23T10:00:00Z");
const coordinates = (fullName: string) =>
  unwrap(RepositoryCoordinates.parse(fullName));

describe.skipIf(!url)("Postgres adapters", () => {
  let pool: Pool;
  let db: Database;

  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    db = drizzle({ client: pool });
    await migrate(db, { migrationsFolder: "drizzle" });
  });

  beforeEach(async () => {
    await db.execute(sql`truncate github_watched_repository cascade`);
  });

  afterAll(async () => {
    await pool?.end();
  });

  describe("DrizzleWatchedRepositoryRepository", () => {
    it("saves and restores a watched repository with its sync state", async () => {
      const repositories = new DrizzleWatchedRepositoryRepository(db);
      const watched = WatchedRepository.watch(
        "user-1",
        coordinates("nordwind/billing-core"),
        t0,
      );
      unwrap(watched.startSync("manual", t0));
      watched.failSync("GitHub is down.", t0);
      unwrap(await repositories.save(watched));

      const [restored] = await new DrizzleWatchedRepositoryRepository(
        db,
      ).findAllFor("user-1");

      expect(restored?.id.equals(watched.id)).toBe(true);
      expect(restored?.coordinates.fullName).toBe("nordwind/billing-core");
      expect(restored?.sync.lastAttemptedAt).toEqual(t0);
      expect(restored?.sync.lastFailure).toBe("GitHub is down.");
      expect(restored?.sync.startedAt).toBeNull();
    });

    it("finds a repository whatever case it is asked for in", async () => {
      const repositories = new DrizzleWatchedRepositoryRepository(db);
      unwrap(
        await repositories.save(
          WatchedRepository.watch(
            "user-1",
            coordinates("Nordwind/Billing-Core"),
            t0,
          ),
        ),
      );

      expect(
        await repositories.findByCoordinates(
          "user-1",
          coordinates("nordwind/billing-core"),
        ),
      ).toBeDefined();
      expect(
        await repositories.findByCoordinates(
          "user-2",
          coordinates("nordwind/billing-core"),
        ),
      ).toBeUndefined();
    });

    it("refuses a second watch of the same repository by the same person", async () => {
      const repositories = new DrizzleWatchedRepositoryRepository(db);
      unwrap(
        await repositories.save(
          WatchedRepository.watch(
            "user-1",
            coordinates("nordwind/billing-core"),
            t0,
          ),
        ),
      );

      const second = await repositories.save(
        WatchedRepository.watch(
          "user-1",
          coordinates("NORDWIND/billing-core"),
          t0,
        ),
      );

      expect(isErr(second)).toBe(true);
    });

    it("lets only the first of two racing saves through", async () => {
      const setup = new DrizzleWatchedRepositoryRepository(db);
      unwrap(
        await setup.save(
          WatchedRepository.watch(
            "user-1",
            coordinates("nordwind/billing-core"),
            t0,
          ),
        ),
      );
      const tabA = new DrizzleWatchedRepositoryRepository(db);
      const tabB = new DrizzleWatchedRepositoryRepository(db);
      const [a] = await tabA.findAllFor("user-1");
      const [b] = await tabB.findAllFor("user-1");
      unwrap(a!.startSync("manual", t0));
      unwrap(b!.startSync("manual", t0));

      expect(isOk(await tabA.save(a!))).toBe(true);
      expect(isErr(await tabB.save(b!))).toBe(true);
    });
  });

  describe("DrizzleRepositorySnapshotStore", () => {
    async function watchedId(): Promise<string> {
      const repository = WatchedRepository.watch(
        "user-1",
        coordinates("nordwind/billing-core"),
        t0,
      );
      unwrap(await new DrizzleWatchedRepositoryRepository(db).save(repository));
      return repository.id.value;
    }

    it("round-trips a snapshot, checks and all", async () => {
      const id = await watchedId();
      const store = new DrizzleRepositorySnapshotStore(db, () => t0);
      const snapshot = aSnapshot({
        openPullRequests: 12,
        openIssues: 38,
        pullRequests: [
          aPullRequest({
            number: 476,
            requestedReviewers: ["mira", "nordwind/payments"],
            approvedBy: ["tom"],
            reviewDecision: "approved",
            checkRollup: "running",
            checks: [
              {
                name: "integration",
                conclusion: "running",
                startedAt: t0,
                completedAt: null,
              },
            ],
          }),
        ],
        issues: [
          anIssue({ number: 1204, labels: ["bug"], assignees: ["mira"] }),
        ],
      });

      await store.replace(id, snapshot);
      const loaded = (await store.load([id])).get(id);

      expect(loaded).toEqual(snapshot);
    });

    it("replaces everything the last sync stored", async () => {
      const id = await watchedId();
      const store = new DrizzleRepositorySnapshotStore(db, () => t0);
      await store.replace(
        id,
        aSnapshot({
          pullRequests: [
            aPullRequest({ number: 1 }),
            aPullRequest({ number: 2 }),
          ],
        }),
      );

      await store.replace(
        id,
        aSnapshot({ pullRequests: [aPullRequest({ number: 3 })] }),
      );

      expect(
        (await store.load([id])).get(id)?.pullRequests.map((pr) => pr.number),
      ).toEqual([3]);
    });

    it("drops the snapshot with the watch, and ignores one for a watch that is gone", async () => {
      const id = await watchedId();
      const store = new DrizzleRepositorySnapshotStore(db, () => t0);
      await store.replace(id, aSnapshot({ pullRequests: [aPullRequest()] }));

      await new DrizzleWatchedRepositoryRepository(db).remove(
        (
          await new DrizzleWatchedRepositoryRepository(db).findAllFor("user-1")
        )[0]!.id,
      );
      await store.replace(id, aSnapshot({ pullRequests: [aPullRequest()] }));

      expect((await store.load([id])).size).toBe(0);
    });
  });
});
