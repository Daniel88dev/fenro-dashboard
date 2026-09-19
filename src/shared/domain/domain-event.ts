/** Something that happened in the domain, recorded by an aggregate. */
export interface DomainEvent {
  readonly name: string;
  readonly aggregateId: string;
  readonly occurredAt: Date;
}

export abstract class BaseDomainEvent implements DomainEvent {
  abstract readonly name: string;
  readonly occurredAt: Date;

  protected constructor(
    readonly aggregateId: string,
    occurredAt?: Date,
  ) {
    this.occurredAt = occurredAt ?? new Date();
  }
}
