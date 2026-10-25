import { BaseDomainEvent } from "@/shared/domain";

import type { SessionOutcome } from "./session";
import type { TaskKind } from "./task-kind";
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

export class TaskKindChanged extends BaseDomainEvent {
  readonly name = "tasks.task-kind-changed";

  constructor(
    aggregateId: string,
    readonly from: TaskKind,
    readonly to: TaskKind,
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

export class LabelRecoloured extends BaseDomainEvent {
  readonly name = "tasks.label-recoloured";

  constructor(
    aggregateId: string,
    readonly colour: string,
    occurredAt?: Date,
  ) {
    super(aggregateId, occurredAt);
  }
}

export class LabelRenamed extends BaseDomainEvent {
  readonly name = "tasks.label-renamed";

  constructor(
    aggregateId: string,
    readonly from: string,
    readonly to: string,
    occurredAt?: Date,
  ) {
    super(aggregateId, occurredAt);
  }
}

export class SkillCreated extends BaseDomainEvent {
  readonly name = "tasks.skill-created";

  constructor(
    aggregateId: string,
    readonly skill: string,
    occurredAt?: Date,
  ) {
    super(aggregateId, occurredAt);
  }
}

export class SkillRevised extends BaseDomainEvent {
  readonly name = "tasks.skill-revised";

  constructor(
    aggregateId: string,
    readonly revision: number,
    occurredAt?: Date,
  ) {
    super(aggregateId, occurredAt);
  }
}

export class SkillLinked extends BaseDomainEvent {
  readonly name = "tasks.skill-linked";

  constructor(
    aggregateId: string,
    readonly labels: readonly string[],
    occurredAt?: Date,
  ) {
    super(aggregateId, occurredAt);
  }
}

export class SkillUnlinked extends BaseDomainEvent {
  readonly name = "tasks.skill-unlinked";

  constructor(
    aggregateId: string,
    readonly labels: readonly string[],
    occurredAt?: Date,
  ) {
    super(aggregateId, occurredAt);
  }
}

export class SkillDeleted extends BaseDomainEvent {
  readonly name = "tasks.skill-deleted";

  constructor(
    aggregateId: string,
    readonly skill: string,
    occurredAt?: Date,
  ) {
    super(aggregateId, occurredAt);
  }
}

export class QuestionnairePosted extends BaseDomainEvent {
  readonly name = "tasks.questionnaire-posted";

  constructor(
    aggregateId: string,
    readonly taskId: string,
    readonly round: number,
    occurredAt?: Date,
  ) {
    super(aggregateId, occurredAt);
  }
}

export class QuestionnaireAnswered extends BaseDomainEvent {
  readonly name = "tasks.questionnaire-answered";

  constructor(
    aggregateId: string,
    readonly taskId: string,
    readonly round: number,
    occurredAt?: Date,
  ) {
    super(aggregateId, occurredAt);
  }
}

export class QuestionnaireWithdrawn extends BaseDomainEvent {
  readonly name = "tasks.questionnaire-withdrawn";

  constructor(
    aggregateId: string,
    readonly taskId: string,
    readonly round: number,
    occurredAt?: Date,
  ) {
    super(aggregateId, occurredAt);
  }
}
