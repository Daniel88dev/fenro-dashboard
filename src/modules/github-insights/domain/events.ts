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

export class RepositorySynced extends BaseDomainEvent {
  readonly name = "github-insights.repository-synced";

  constructor(
    aggregateId: string,
    readonly fullName: string,
    occurredAt?: Date,
  ) {
    super(aggregateId, occurredAt);
  }
}

export class RepositorySyncFailed extends BaseDomainEvent {
  readonly name = "github-insights.repository-sync-failed";

  constructor(
    aggregateId: string,
    readonly fullName: string,
    readonly reason: string,
    occurredAt?: Date,
  ) {
    super(aggregateId, occurredAt);
  }
}
