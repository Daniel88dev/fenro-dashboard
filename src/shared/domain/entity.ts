import type { DomainEvent } from "./domain-event";
import type { UniqueId } from "./identifier";

/** Domain object with a lifetime and an identity that outlives its values. */
export abstract class Entity<Props extends object> {
  protected constructor(
    readonly id: UniqueId,
    protected readonly props: Props,
  ) {}

  equals(other?: Entity<Props>): boolean {
    if (other === undefined || other === null) return false;
    if (other.constructor !== this.constructor) return false;
    return this.id.equals(other.id);
  }
}

/**
 * Consistency boundary: the only entity a repository loads and saves, and the
 * only place domain events are recorded.
 */
export abstract class AggregateRoot<
  Props extends object,
> extends Entity<Props> {
  #events: DomainEvent[] = [];

  get domainEvents(): readonly DomainEvent[] {
    return this.#events;
  }

  protected record(event: DomainEvent): void {
    this.#events.push(event);
  }

  /** Hand the recorded events to the caller and clear them. */
  pullDomainEvents(): DomainEvent[] {
    const events = this.#events;
    this.#events = [];
    return events;
  }
}
