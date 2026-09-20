import type {
  InsightsUnavailable,
  RepositoryInsightsReader,
} from "@/modules/github-insights/application/ports/repository-insights.reader";
import type {
  OpenIssues,
  OpenPullRequests,
  PullRequestChecks,
  RepositoryCounts,
} from "@/modules/github-insights/application/queries/read-models";
import type { Viewer } from "@/modules/github-insights/application/ports/viewer";
import type { RepositoryCoordinates } from "@/modules/github-insights/domain";
import { ok, type Result } from "@/shared/domain";

import { SAMPLE_REPOSITORIES, type SampleRepository } from "./sample-insights";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/**
 * Serves the prototype's sample data through the read port, so the screen can
 * be built and tested before ticket 05 decides whether the real thing is a live
 * GitHub read or a synced snapshot.
 *
 * The clock is injected because every age in the sample data is an offset: with
 * a fixed clock the table renders identically in a test and in a screenshot.
 *
 * The viewer is injected for the same reason the real adapter will need it: who
 * "you" are is a per-request fact once sign-in exists (ticket 03), not a
 * constant the sample data can bake in.
 */
export class InMemoryRepositoryInsightsReader implements RepositoryInsightsReader {
  readonly #byFullName: Map<string, SampleRepository>;
  readonly #viewer: Viewer | null;
  readonly #now: () => Date;

  constructor(
    viewer: Viewer | null = null,
    repositories: readonly SampleRepository[] = SAMPLE_REPOSITORIES,
    now: () => Date = () => new Date(),
  ) {
    this.#byFullName = new Map(
      repositories.map((repository) => [
        `${repository.owner}/${repository.name}`,
        repository,
      ]),
    );
    this.#viewer = viewer;
    this.#now = now;
  }

  countsFor(
    coordinates: readonly RepositoryCoordinates[],
  ): Promise<Result<RepositoryCounts[], InsightsUnavailable>> {
    const counts = coordinates.flatMap((one) => {
      const sample = this.#byFullName.get(one.fullName);
      if (!sample) return [];
      return [
        {
          owner: sample.owner,
          name: sample.name,
          openPullRequests: sample.openPullRequests,
          openIssues: sample.openIssues,
          pullRequestHint: sample.pullRequestHint,
          issueHint: sample.issueHint,
          lastActivityAt: this.#minutesAgo(sample.lastActivityMinutesAgo),
        },
      ];
    });

    return Promise.resolve(ok(counts));
  }

  openPullRequests(
    coordinates: RepositoryCoordinates,
  ): Promise<Result<OpenPullRequests, InsightsUnavailable>> {
    const sample = this.#byFullName.get(coordinates.fullName);
    if (!sample) {
      return Promise.resolve(
        ok({ summary: "nothing open yet", totalOpen: 0, shown: [] }),
      );
    }

    return Promise.resolve(
      ok({
        summary: sample.pullRequestSummary,
        totalOpen: sample.openPullRequests,
        shown: sample.pullRequests.map((pullRequest) => ({
          number: pullRequest.number,
          title: pullRequest.title,
          author: this.#whoIs(pullRequest.author),
          openedAt: this.#daysAgo(pullRequest.openedDaysAgo),
          reviewState: pullRequest.reviewState,
          reviewLabel: pullRequest.reviewLabel,
          checkRollup: pullRequest.checkRollup,
          checkSummary: pullRequest.checkSummary,
        })),
      }),
    );
  }

  pullRequestChecks(
    coordinates: RepositoryCoordinates,
    number: number,
  ): Promise<Result<PullRequestChecks | null, InsightsUnavailable>> {
    const sample = this.#byFullName
      .get(coordinates.fullName)
      ?.pullRequests.find((pullRequest) => pullRequest.number === number);

    if (!sample) return Promise.resolve(ok(null));

    return Promise.resolve(
      ok({
        headSha: sample.headSha,
        checks: sample.checks,
        blockingReason: sample.blockingReason,
      }),
    );
  }

  openIssues(
    coordinates: RepositoryCoordinates,
  ): Promise<Result<OpenIssues, InsightsUnavailable>> {
    const sample = this.#byFullName.get(coordinates.fullName);
    if (!sample) {
      return Promise.resolve(
        ok({ summary: "nothing open yet", totalOpen: 0, shown: [] }),
      );
    }

    return Promise.resolve(
      ok({
        summary: sample.issueSummary,
        totalOpen: sample.openIssues,
        shown: sample.issues.map((issue) => ({
          number: issue.number,
          title: issue.title,
          label: issue.label,
          openedAt: this.#daysAgo(issue.openedDaysAgo),
          assignee:
            issue.assignee === null ? null : this.#whoIs(issue.assignee),
        })),
      }),
    );
  }

  /** The viewer reads as "you" everywhere; everyone else keeps their login. */
  #whoIs(login: string): string {
    return login === this.#viewer?.login ? "you" : login;
  }

  #minutesAgo(minutes: number): Date {
    return new Date(this.#now().getTime() - minutes * MINUTE);
  }

  #daysAgo(days: number): Date {
    return new Date(this.#now().getTime() - days * DAY);
  }
}
