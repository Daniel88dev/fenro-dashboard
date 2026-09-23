import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * github-insights keeps two kinds of table. `github_watched_repository` is the
 * `WatchedRepository` aggregate: which repositories each person watches, and
 * where each one's sync stands. The rest are the snapshot a sync copies out of
 * GitHub, read models that belong to one watched repository and go when it is
 * unwatched.
 *
 * Timestamps carry their time zone, as in the identity tables.
 */
const instant = (name: string) => timestamp(name, { withTimezone: true });

export const watchedRepository = pgTable(
  "github_watched_repository",
  {
    id: text("id").primaryKey(),
    /**
     * The identity context's user id. Deliberately not a foreign key: the
     * contexts share a database, not a schema, and neither migrates the
     * other's tables.
     */
    watcherId: text("watcher_id").notNull(),
    /** As GitHub spells them, checked when the repository was watched. */
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    watchedAt: instant("watched_at").notNull(),
    lastSyncedAt: instant("last_synced_at"),
    lastSyncAttemptedAt: instant("last_sync_attempted_at"),
    lastSyncFailure: text("last_sync_failure"),
    /** When the sync in flight started; the lease two requests race for. */
    syncStartedAt: instant("sync_started_at"),
    /** Bumped on every save, so a save over someone else's fails. */
    version: integer("version").notNull(),
  },
  (table) => [
    // GitHub names are case-insensitive, so the same repository typed twice
    // in different case is still one watch.
    uniqueIndex("github_watched_repository_watcher_repository_idx").on(
      table.watcherId,
      sql`lower(${table.owner})`,
      sql`lower(${table.name})`,
    ),
  ],
);

const repositoryId = () =>
  text("repository_id")
    .notNull()
    .references(() => watchedRepository.id, { onDelete: "cascade" });

export const repositorySnapshot = pgTable("github_repository_snapshot", {
  repositoryId: repositoryId().primaryKey(),
  openPullRequests: integer("open_pull_requests").notNull(),
  openIssues: integer("open_issues").notNull(),
  lastActivityAt: instant("last_activity_at"),
  fetchedAt: instant("fetched_at").notNull(),
});

/** A check on a pull request's head commit, as stored in `checks`. */
export type StoredCheck = {
  readonly name: string;
  readonly conclusion: "passed" | "failed" | "running" | "skipped";
  readonly startedAt: string | null;
  readonly completedAt: string | null;
};

export const pullRequest = pgTable(
  "github_pull_request",
  {
    repositoryId: repositoryId(),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    author: text("author"),
    isDraft: boolean("is_draft").notNull(),
    openedAt: instant("opened_at").notNull(),
    updatedAt: instant("updated_at").notNull(),
    /** GitHub's review decision: approved, changes-requested, review-required. */
    reviewDecision: text("review_decision"),
    requestedReviewers: text("requested_reviewers").array().notNull(),
    approvedBy: text("approved_by").array().notNull(),
    changesRequestedBy: text("changes_requested_by").array().notNull(),
    headSha: text("head_sha"),
    /** GitHub's rollup over every check: passed, failed, running or none. */
    checkRollup: text("check_rollup").notNull(),
    /** Always read with the pull request and never queried on its own. */
    checks: jsonb("checks").$type<StoredCheck[]>().notNull(),
  },
  (table) => [primaryKey({ columns: [table.repositoryId, table.number] })],
);

export const issue = pgTable(
  "github_issue",
  {
    repositoryId: repositoryId(),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    labels: text("labels").array().notNull(),
    assignees: text("assignees").array().notNull(),
    openedAt: instant("opened_at").notNull(),
    updatedAt: instant("updated_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.repositoryId, table.number] })],
);
