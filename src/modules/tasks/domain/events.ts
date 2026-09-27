import { BaseDomainEvent } from "@/shared/domain";

import type { SessionOutcome } from "./session";
import type { TaskStatus } from "./task-status";

export class TaskCreated extends BaseDomainEvent {
  readonly name = "tasks.task-created";

  constructor(
    aggregateId: string,
    readonly key: string,
    occurredAt?: Date,
  ) {
    super(aggregateId, occurredAt);
  }
}

export class TaskStatusChanged extends BaseDomainEvent {
  readonly name = "tasks.task-status-changed";

  constructor(
    aggregateId: string,
    readonly from: TaskStatus,
    readonly to: TaskStatus,
    occurredAt?: Date,
  ) {
    super(aggregateId, occurredAt);
  }
}

export class SessionStarted extends BaseDomainEvent {
  readonly name = "tasks.session-started";

  constructor(
    aggregateId: string,
    readonly sessionId: string,
    occurredAt?: Date,
  ) {
    super(aggregateId, occurredAt);
  }
}

export class SessionEnded extends BaseDomainEvent {
  readonly name = "tasks.session-ended";

  constructor(
    aggregateId: string,
    readonly sessionId: string,
    readonly outcome: SessionOutcome,
    occurredAt?: Date,
  ) {
    super(aggregateId, occurredAt);
  }
}

export class LabelCreated extends BaseDomainEvent {
  readonly name = "tasks.label-created";

  constructor(
    aggregateId: string,
    readonly label: string,
    occurredAt?: Date,
  ) {
    super(aggregateId, occurredAt);
  }
}

export class PictureAdded extends BaseDomainEvent {
  readonly name = "tasks.picture-added";

  constructor(
    aggregateId: string,
    readonly taskId: string,
    occurredAt?: Date,
  ) {
    super(aggregateId, occurredAt);
  }
}

export class PictureRemoved extends BaseDomainEvent {
  readonly name = "tasks.picture-removed";

  constructor(
    aggregateId: string,
    readonly taskId: string,
    occurredAt?: Date,
  ) {
    super(aggregateId, occurredAt);
  }
}
