import type { DomainEvent } from "./domain-event";
import type { UniqueId } from "./identifier";

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

  pullDomainEvents(): DomainEvent[] {
    const events = this.#events;
    this.#events = [];
    return events;
  }
}
