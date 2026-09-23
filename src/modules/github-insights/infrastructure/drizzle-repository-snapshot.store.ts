import { eq, inArray } from "drizzle-orm";

import type {
  CheckRecord,
  IssueRecord,
  PullRequestRecord,
  RepositorySnapshot,
  RepositorySnapshotStore,
  ReviewDecision,
} from "@/modules/github-insights/application/ports/repository-snapshot";
import type { CheckRollup } from "@/modules/github-insights/application/queries/read-models";
import type { Database } from "@/shared/infrastructure/database/client";

import {
  issue,
  pullRequest,
  repositorySnapshot,
  watchedRepository,
  type StoredCheck,
} from "./persistence/schema";

/**
 * Snapshots in Postgres. A replace swaps everything a repository had for what
 * the latest sync saw, inside one transaction, so a reader sees either the old
 * snapshot or the new one and never half of each.
 */
export class DrizzleRepositorySnapshotStore implements RepositorySnapshotStore {
  constructor(
    private readonly db: Database,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async replace(
    repositoryId: string,
    snapshot: RepositorySnapshot,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      // Lock the watch first: if it was unwatched while GitHub was being
      // read, there is nothing to store the snapshot against.
      const [watched] = await tx
        .select({ id: watchedRepository.id })
        .from(watchedRepository)
        .where(eq(watchedRepository.id, repositoryId))
        .for("update");
      if (!watched) return;

      await tx
        .delete(pullRequest)
        .where(eq(pullRequest.repositoryId, repositoryId));
      await tx.delete(issue).where(eq(issue.repositoryId, repositoryId));

      const counts = {
        openPullRequests: snapshot.openPullRequests,
        openIssues: snapshot.openIssues,
        lastActivityAt: snapshot.lastActivityAt,
        fetchedAt: this.clock(),
      };
      await tx
        .insert(repositorySnapshot)
        .values({ repositoryId, ...counts })
        .onConflictDoUpdate({
          target: repositorySnapshot.repositoryId,
          set: counts,
        });

      if (snapshot.pullRequests.length > 0) {
        await tx.insert(pullRequest).values(
          snapshot.pullRequests.map((one) => ({
            repositoryId,
            number: one.number,
            title: one.title,
            author: one.author,
            isDraft: one.isDraft,
            openedAt: one.openedAt,
            updatedAt: one.updatedAt,
            reviewDecision: one.reviewDecision,
            requestedReviewers: [...one.requestedReviewers],
            approvedBy: [...one.approvedBy],
            changesRequestedBy: [...one.changesRequestedBy],
            headSha: one.headSha,
            checkRollup: one.checkRollup,
            checks: one.checks.map(toStoredCheck),
          })),
        );
      }
      if (snapshot.issues.length > 0) {
        await tx.insert(issue).values(
          snapshot.issues.map((one) => ({
            repositoryId,
            number: one.number,
            title: one.title,
            labels: [...one.labels],
            assignees: [...one.assignees],
            openedAt: one.openedAt,
            updatedAt: one.updatedAt,
          })),
        );
      }
    });
  }

  async load(
    repositoryIds: readonly string[],
  ): Promise<ReadonlyMap<string, RepositorySnapshot>> {
    if (repositoryIds.length === 0) return new Map();
    const ids = [...repositoryIds];

    const [snapshots, pullRequests, issues] = await Promise.all([
      this.db
        .select()
        .from(repositorySnapshot)
        .where(inArray(repositorySnapshot.repositoryId, ids)),
      this.db
        .select()
        .from(pullRequest)
        .where(inArray(pullRequest.repositoryId, ids)),
      this.db.select().from(issue).where(inArray(issue.repositoryId, ids)),
    ]);

    return new Map(
      snapshots.map((row) => [
        row.repositoryId,
        {
          openPullRequests: row.openPullRequests,
          openIssues: row.openIssues,
          lastActivityAt: row.lastActivityAt,
          pullRequests: pullRequests
            .filter((one) => one.repositoryId === row.repositoryId)
            .map((one): PullRequestRecord => ({
              number: one.number,
              title: one.title,
              author: one.author,
              isDraft: one.isDraft,
              openedAt: one.openedAt,
              updatedAt: one.updatedAt,
              reviewDecision: one.reviewDecision as ReviewDecision | null,
              requestedReviewers: one.requestedReviewers,
              approvedBy: one.approvedBy,
              changesRequestedBy: one.changesRequestedBy,
              headSha: one.headSha,
              checkRollup: one.checkRollup as CheckRollup,
              checks: one.checks.map(fromStoredCheck),
            })),
          issues: issues
            .filter((one) => one.repositoryId === row.repositoryId)
            .map((one): IssueRecord => ({
              number: one.number,
              title: one.title,
              labels: one.labels,
              assignees: one.assignees,
              openedAt: one.openedAt,
              updatedAt: one.updatedAt,
            })),
        },
      ]),
    );
  }
}

function toStoredCheck(check: CheckRecord): StoredCheck {
  return {
    name: check.name,
    conclusion: check.conclusion,
    startedAt: check.startedAt?.toISOString() ?? null,
    completedAt: check.completedAt?.toISOString() ?? null,
  };
}

function fromStoredCheck(check: StoredCheck): CheckRecord {
  return {
    name: check.name,
    conclusion: check.conclusion,
    startedAt: check.startedAt ? new Date(check.startedAt) : null,
    completedAt: check.completedAt ? new Date(check.completedAt) : null,
  };
}
