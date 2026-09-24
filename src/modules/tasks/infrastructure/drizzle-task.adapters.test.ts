// @vitest-environment node
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  ExternalReference,
  RepositoryReference,
  Task,
  type Actor,
  type NewTask,
  type TaskSurroundings,
} from "@/modules/tasks/domain";
import { getEnv } from "@/shared/config/env";
import { isErr, isOk, unwrap } from "@/shared/domain";
import type { Database } from "@/shared/infrastructure/database/client";

import { DrizzleTaskReadStore } from "./drizzle-task.read-store";
import { DrizzleTaskRepository } from "./drizzle-task.repository";
import { taskJournalEntry } from "./persistence/schema";

/**
 * Runs against a real Postgres, because what these adapters promise — the
 * aggregate spread over five tables coming back whole, the version check, a
 * number taken once per owner, reads that never cross owners — is Postgres
 * behaviour a fake cannot prove.
 */
const url = getEnv().TEST_DATABASE_URL;

const t0 = new Date("2026-09-23T10:00:00Z");
const later = (minutes: number) => new Date(t0.getTime() + minutes * 60_000);

const daniel: Actor = { kind: "human", id: "user-1", name: "Daniel" };
const claude: Actor = { kind: "agent", id: "token-1", name: "claude-code" };
const cursor: Actor = { kind: "agent", id: "token-2", name: "cursor" };

const clear: TaskSurroundings = { openBlockers: [], openSubtasks: [] };

let ids = 0;
function aTask(overrides: Partial<NewTask> & { number: number }): Task {
  ids += 1;
  return unwrap(
    Task.create({
      id: `task-${ids}`,
      ownerId: "user-1",
      title: `Task ${overrides.number}`,
      author: daniel,
      now: t0,
      ...overrides,
    }),
  );
}

const reference = (link: string, options?: { isSource?: boolean }) =>
  unwrap(
    ExternalReference.fromUrl(link, { title: `About ${link}`, ...options }),
  );

describe.skipIf(!url)("Postgres tasks adapters", () => {
  let pool: Pool;
  let db: Database;

  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    db = drizzle({ client: pool });
  });

  beforeEach(async () => {
    await db.execute(sql`truncate task cascade`);
  });

  afterAll(async () => {
    await pool?.end();
  });

  async function saved(...tasks: Task[]): Promise<void> {
    const repository = new DrizzleTaskRepository(db);
    for (const task of tasks) unwrap(await repository.save(task));
  }

  describe("DrizzleTaskRepository", () => {
    it("saves a new task and finds it by id and by number", async () => {
      const task = aTask({ number: 1, title: "Split the settlement reducer" });
      await saved(task);

      const repository = new DrizzleTaskRepository(db);
      const byId = await repository.findById("user-1", task.id.value);
      const byNumber = await repository.findByNumber("user-1", 1);

      expect(byId?.key).toBe("T-1");
      expect(byId?.state.title).toBe("Split the settlement reducer");
      expect(byNumber?.id.equals(task.id)).toBe(true);
      expect(await repository.findByNumber("user-1", 2)).toBeUndefined();
    });

    it("round-trips everything a task holds", async () => {
      const parent = aTask({ number: 1 });
      const blocker = aTask({ number: 2 });
      const task = aTask({
        number: 3,
        title: "Make the settlement reducer two aggregates",
        description: "The reducer mixes payouts with refunds.",
        priority: "high",
        labels: ["backend", "Infra"],
        repository: unwrap(RepositoryReference.parse("Nordwind/Billing-Core")),
        parentId: parent.id.value,
        criteria: ["Payouts have their own aggregate", "Refunds too"],
        references: [
          reference("https://github.com/nordwind/billing-core/issues/12", {
            isSource: true,
          }),
          reference("https://nordwind.atlassian.net/browse/PAY-4"),
        ],
      });
      await saved(parent, blocker, task);

      const repository = new DrizzleTaskRepository(db);
      const loaded = (await repository.findById("user-1", task.id.value))!;
      unwrap(loaded.link("blocked-by", blocker.id.value, daniel, later(1)));
      unwrap(loaded.link("relates-to", parent.id.value, daniel, later(1)));
      unwrap(loaded.note("note", "Read ticket 08 first.", daniel, later(2)));
      unwrap(loaded.startSession(claude, clear, later(3)));
      unwrap(loaded.checkCriterion(1, true, "PR #480", claude, later(4)));
      unwrap(loaded.note("decision", "Refunds wait.", claude, later(5)));
      unwrap(
        loaded.finishSession(
          claude,
          { outcome: "paused", summary: "Payouts are split." },
          clear,
          later(6),
        ),
      );
      unwrap(loaded.startSession(cursor, clear, later(7)));
      unwrap(loaded.putOnHold("Waiting on finance", cursor, later(8)));
      unwrap(await repository.save(loaded));

      const restored = (await new DrizzleTaskRepository(db).findById(
        "user-1",
        task.id.value,
      ))!;

      expect(restored.createdAt).toEqual(t0);
      expect(restored.state).toEqual(loaded.state);
      expect(restored.state.labels).toEqual(["backend", "infra"]);
      expect(restored.state.repository?.fullName).toBe("Nordwind/Billing-Core");
      expect(restored.state.references.map((ref) => ref.isSource)).toEqual([
        true,
        false,
      ]);
      expect(restored.state.hold).toEqual({
        reason: "Waiting on finance",
        since: later(8),
      });
      expect(restored.sessions.map((session) => session.outcome)).toEqual([
        "paused",
        null,
      ]);

      const [first, second] = loaded.sessions;
      const journal = await db
        .select()
        .from(taskJournalEntry)
        .where(eq(taskJournalEntry.taskId, task.id.value))
        .orderBy(taskJournalEntry.recordedAt);
      expect(
        journal.map((entry) => [
          entry.kind,
          entry.text,
          entry.authorKind,
          entry.authorName,
          entry.sessionId,
        ]),
      ).toEqual([
        ["note", "Read ticket 08 first.", "human", "Daniel", null],
        ["decision", "Refunds wait.", "agent", "claude-code", first!.id],
        ["handoff", "Payouts are split.", "agent", "claude-code", first!.id],
      ]);
      expect(second!.actor).toEqual(cursor);
    });

    it("adds journal entries once, however often the task is saved", async () => {
      const task = aTask({ number: 1 });
      unwrap(task.note("note", "First thought.", daniel, later(1)));
      const repository = new DrizzleTaskRepository(db);
      unwrap(await repository.save(task));
      unwrap(await repository.save(task));

      const journal = await db
        .select()
        .from(taskJournalEntry)
        .where(eq(taskJournalEntry.taskId, task.id.value));
      expect(journal).toHaveLength(1);
    });

    it("refuses to save over a copy that changed since it was read", async () => {
      const task = aTask({ number: 1 });
      await saved(task);
      const tabA = new DrizzleTaskRepository(db);
      const tabB = new DrizzleTaskRepository(db);
      const a = (await tabA.findById("user-1", task.id.value))!;
      const b = (await tabB.findById("user-1", task.id.value))!;
      unwrap(a.edit({ title: "From tab A" }, daniel, later(1)));
      unwrap(b.edit({ title: "From tab B" }, daniel, later(1)));

      expect(isOk(await tabA.save(a))).toBe(true);
      const second = await tabB.save(b);

      expect(isErr(second) && second.error.code).toBe(
        "concurrent-modification",
      );
      expect((await tabA.findById("user-1", task.id.value))?.state.title).toBe(
        "From tab A",
      );
    });

    it("keeps saving a task it saved itself", async () => {
      const repository = new DrizzleTaskRepository(db);
      const task = aTask({ number: 1 });
      unwrap(await repository.save(task));
      unwrap(task.edit({ title: "Renamed" }, daniel, later(1)));

      expect(isOk(await repository.save(task))).toBe(true);
    });

    it("refuses a new task whose number was taken in the meantime", async () => {
      await saved(aTask({ number: 1 }));

      const second = await new DrizzleTaskRepository(db).save(
        aTask({ number: 1 }),
      );

      expect(isErr(second) && second.error.code).toBe(
        "concurrent-modification",
      );
    });

    it("numbers each owner's tasks on from their highest", async () => {
      const repository = new DrizzleTaskRepository(db);
      expect(await repository.nextNumber("user-1")).toBe(1);

      await saved(aTask({ number: 1 }), aTask({ number: 5 }));

      expect(await repository.nextNumber("user-1")).toBe(6);
      expect(await repository.nextNumber("user-2")).toBe(1);
    });

    it("builds the graph from blocking links and parents", async () => {
      const parent = aTask({ number: 1 });
      const child = aTask({ number: 2, parentId: parent.id.value });
      const blocker = aTask({ number: 3 });
      const blocked = aTask({ number: 4 });
      unwrap(blocked.link("blocked-by", blocker.id.value, daniel, t0));
      unwrap(blocked.link("relates-to", parent.id.value, daniel, t0));
      await saved(parent, child, blocker, blocked);

      const graph = await new DrizzleTaskRepository(db).graph("user-1");

      expect(graph.surroundingsOf(blocked.id.value)).toEqual({
        openBlockers: ["T-3"],
        openSubtasks: [],
      });
      expect(graph.surroundingsOf(parent.id.value)).toEqual({
        openBlockers: [],
        openSubtasks: ["T-2"],
      });
      expect(
        graph.wouldCycleByBlocking(blocker.id.value, blocked.id.value),
      ).toBe(true);
      expect(graph.wouldCycleByParent(parent.id.value, child.id.value)).toBe(
        true,
      );
      expect(
        (await new DrizzleTaskRepository(db).graph("user-2")).surroundingsOf(
          blocked.id.value,
        ),
      ).toEqual(clear);
    });
  });

  describe("DrizzleTaskReadStore", () => {
    /** T-1 blocks T-2; T-2 has two sessions, notes and a met criterion. */
    async function aWorkedTask() {
      const blocker = aTask({ number: 1, title: "Agree the payout model" });
      const task = aTask({
        number: 2,
        title: "Split the settlement reducer",
        description: "The reducer mixes payouts with refunds.",
        labels: ["backend"],
        repository: unwrap(RepositoryReference.parse("nordwind/billing-core")),
        criteria: ["Payouts split", "Refunds split"],
        references: [
          reference("https://github.com/nordwind/billing-core/issues/12", {
            isSource: true,
          }),
          reference("https://example.com/design"),
        ],
      });
      unwrap(task.link("blocked-by", blocker.id.value, daniel, t0));
      unwrap(task.note("note", "Read ticket 08 first.", daniel, later(1)));
      unwrap(task.startSession(claude, clear, later(2)));
      unwrap(task.checkCriterion(1, true, "PR #480", claude, later(3)));
      unwrap(task.note("discovery", "Refunds share state.", claude, later(4)));
      unwrap(
        task.finishSession(
          claude,
          { outcome: "paused", summary: "Payouts are split." },
          clear,
          later(5),
        ),
      );
      unwrap(task.startSession(cursor, clear, later(6)));
      await saved(blocker, task);
      return { blocker, task };
    }

    it("lists records with their latest session and counts", async () => {
      const { blocker, task } = await aWorkedTask();

      const records = await new DrizzleTaskReadStore(db).records("user-1");
      const record = records.find((row) => row.id === task.id.value)!;
      const blockerRecord = records.find((row) => row.id === blocker.id.value)!;

      expect(records).toHaveLength(2);
      expect(record).toMatchObject({
        number: 2,
        title: "Split the settlement reducer",
        status: "in_progress",
        priority: "none",
        labels: ["backend"],
        repository: { owner: "nordwind", name: "billing-core" },
        parentId: null,
        blockedBy: [blocker.id.value],
        hold: null,
        criteriaMet: 1,
        criteriaTotal: 2,
        journalEntries: 3,
        createdAt: t0,
        updatedAt: task.state.updatedAt,
      });
      expect(record.latestSession).toEqual({
        id: task.sessions[1]!.id,
        number: 2,
        actorKind: "agent",
        actorName: "cursor",
        startedAt: later(6),
        lastSeenAt: later(6),
        endedAt: null,
        outcome: null,
      });
      expect(blockerRecord).toMatchObject({
        blockedBy: [],
        latestSession: null,
        criteriaTotal: 0,
        journalEntries: 0,
      });
    });

    it("reads one task in full", async () => {
      const { blocker, task } = await aWorkedTask();
      const store = new DrizzleTaskReadStore(db);

      const detail = (await store.detail("user-1", task.id.value))!;

      expect(detail.description).toBe(
        "The reducer mixes payouts with refunds.",
      );
      expect(detail.criteria).toEqual([
        {
          number: 1,
          text: "Payouts split",
          metAt: later(3),
          evidence: "PR #480",
        },
        { number: 2, text: "Refunds split", metAt: null, evidence: null },
      ]);
      expect(detail.links).toEqual([
        { kind: "blocked-by", taskId: blocker.id.value },
      ]);
      expect(detail.references).toEqual([
        {
          system: "github-issue",
          key: "nordwind/billing-core#12",
          url: "https://github.com/nordwind/billing-core/issues/12",
          title: "About https://github.com/nordwind/billing-core/issues/12",
          isSource: true,
        },
        {
          system: "url",
          key: "https://example.com/design",
          url: "https://example.com/design",
          title: "About https://example.com/design",
          isSource: false,
        },
      ]);
      expect(
        detail.sessions.map((session) => [
          session.number,
          session.actorName,
          session.outcome,
        ]),
      ).toEqual([
        [1, "claude-code", "paused"],
        [2, "cursor", null],
      ]);
      expect(detail.journal).toEqual([
        {
          kind: "note",
          text: "Read ticket 08 first.",
          authorKind: "human",
          authorName: "Daniel",
          sessionNumber: null,
          recordedAt: later(1),
        },
        {
          kind: "discovery",
          text: "Refunds share state.",
          authorKind: "agent",
          authorName: "claude-code",
          sessionNumber: 1,
          recordedAt: later(4),
        },
        {
          kind: "handoff",
          text: "Payouts are split.",
          authorKind: "agent",
          authorName: "claude-code",
          sessionNumber: 1,
          recordedAt: later(5),
        },
      ]);
      expect(detail.completedAt).toBeNull();

      const blockerDetail = (await store.detail("user-1", blocker.id.value))!;
      expect(blockerDetail.incoming).toEqual([
        { kind: "blocked-by", taskId: task.id.value },
      ]);
      expect(blockerDetail.links).toEqual([]);
    });
  });

  describe("across owners", () => {
    it("keeps each owner's tasks to themselves", async () => {
      const mine = aTask({ number: 1 });
      const theirs = aTask({ number: 1, ownerId: "user-2" });
      await saved(mine, theirs);

      const repository = new DrizzleTaskRepository(db);
      const store = new DrizzleTaskReadStore(db);

      expect(
        await repository.findById("user-2", mine.id.value),
      ).toBeUndefined();
      expect(
        (await repository.findByNumber("user-2", 1))?.id.equals(theirs.id),
      ).toBe(true);
      expect(await store.detail("user-2", mine.id.value)).toBeUndefined();
      expect(
        (await store.records("user-1")).map((record) => record.id),
      ).toEqual([mine.id.value]);
      expect(await store.records("user-3")).toEqual([]);
    });
  });
});
