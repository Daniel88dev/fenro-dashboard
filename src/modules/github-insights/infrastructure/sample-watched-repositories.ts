import {
  RepositoryCoordinates,
  WatchedRepository,
} from "@/modules/github-insights/domain";
import { isErr } from "@/shared/domain";

import { SAMPLE_REPOSITORIES } from "./sample-insights";

/**
 * The repositories the dashboard starts out watching. They match the sample
 * insights so the first run of the app shows the screen the prototype drew;
 * once a real store lands (ticket 07) this seed goes away.
 */
export function sampleWatchedRepositories(
  watchedAt: Date = new Date(),
): WatchedRepository[] {
  return SAMPLE_REPOSITORIES.map((sample) => {
    const coordinates = RepositoryCoordinates.create(sample.owner, sample.name);
    if (isErr(coordinates)) {
      throw new Error(
        `Sample data holds coordinates the domain refuses: ${coordinates.error.message}`,
      );
    }
    return WatchedRepository.watch(coordinates.value, watchedAt);
  });
}
