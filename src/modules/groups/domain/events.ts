import { BaseDomainEvent } from "@/shared/domain";

export class GroupCreated extends BaseDomainEvent {
  readonly name = "groups.group-created";

  constructor(
    aggregateId: string,
    readonly prefix: string,
    occurredAt: Date,
  ) {
    super(aggregateId, occurredAt);
  }
}

export class MemberJoined extends BaseDomainEvent {
  readonly name = "groups.member-joined";

  constructor(
    aggregateId: string,
    readonly userId: string,
    occurredAt: Date,
  ) {
    super(aggregateId, occurredAt);
  }
}

export class MemberLeft extends BaseDomainEvent {
  readonly name = "groups.member-left";

  constructor(
    aggregateId: string,
    readonly userId: string,
    occurredAt: Date,
  ) {
    super(aggregateId, occurredAt);
  }
}
