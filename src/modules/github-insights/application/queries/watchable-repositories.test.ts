import { describe, expect, it } from "vitest";

import { gitHubFailure } from "@/modules/github-insights/application/ports/github-gateway";
import { aSnapshot } from "@/modules/github-insights/application/ports/repository-snapshot.fixtures";
import { FakeGitHubGateway } from "@/modules/github-insights/infrastructure/fake-github.gateway";
import { InMemoryWatchedRepositoryRepository } from "@/modules/github-insights/infrastructure/in-memory-watched-repository.repository";
import {
  RepositoryCoordinates,
  WatchedRepository,
} from "@/modules/github-insights/domain";
import { isErr, unwrap } from "@/shared/domain";

import {
  WatchableRepositoriesHandler,
  watchableRepositoriesQuery,
} from "./watchable-repositories";

const t0 = new Date("2026-09-23T10:00:00Z");

async function watching(
  repositories: InMemoryWatchedRepositoryRepository,
  watcherId: string,
  fullName: string,
) {
  await repositories.save(
    WatchedRepository.watch(
      watcherId,
      unwrap(RepositoryCoordinates.parse(fullName)),
      t0,
    ),
  );
}

describe("watchable-repositories", () => {
  it("offers what GitHub lets the viewer see, marking what this viewer already watches", async () => {
    const gitHub = new FakeGitHubGateway({
      "nordwind/billing-core": aSnapshot(),
      "nordwind/docs-site": aSnapshot(),
    });
    const repositories = new InMemoryWatchedRepositoryRepository();
    await watching(repositories, "user-1", "Nordwind/Billing-Core");
    await watching(repositories, "user-2", "nordwind/docs-site");

    const result = unwrap(
      await new WatchableRepositoriesHandler(gitHub, repositories).handle(
        watchableRepositoriesQuery("user-1"),
      ),
    );

    expect(
      result.map((one) => [`${one.owner}/${one.name}`, one.watched]),
    ).toEqual([
      ["nordwind/billing-core", true],
      ["nordwind/docs-site", false],
    ]);
  });

  it("hands GitHub's failure back rather than an empty list", async () => {
    const gitHub = new FakeGitHubGateway();
    gitHub.failure = gitHubFailure("github-forbidden", "GitHub refused.");

    const result = await new WatchableRepositoriesHandler(
      gitHub,
      new InMemoryWatchedRepositoryRepository(),
    ).handle(watchableRepositoriesQuery("user-1"));

    expect(isErr(result) && result.error.code).toBe("github-forbidden");
  });
});
