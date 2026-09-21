import { BaseDomainEvent } from "@/shared/domain";

export class RepositoryWatched extends BaseDomainEvent {
  readonly name = "github-insights.repository-watched";

  constructor(
    aggregateId: string,
    readonly fullName: string,
    occurredAt?: Date,
  ) {
    super(aggregateId, occurredAt);
  }
}

export class RepositoryUnwatched extends BaseDomainEvent {
  readonly name = "github-insights.repository-unwatched";

  constructor(
    aggregateId: string,
    readonly fullName: string,
    occurredAt?: Date,
  ) {
    super(aggregateId, occurredAt);
  }
}
