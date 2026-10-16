import type { Actor } from "./actor";

export const SESSION_LEASE_MS = 2 * 60 * 60 * 1000;

export const SESSION_OUTCOMES = [
  "done",
  "in_review",
  "paused",
  "blocked",
  "released",
] as const;

export type FinishOutcome = (typeof SESSION_OUTCOMES)[number];

export type SessionOutcome = FinishOutcome | "lapsed" | "cancelled";

export type SessionProps = {
  readonly id: string;
  readonly number: number;
  readonly actor: Actor;
  readonly startedAt: Date;
  readonly lastSeenAt: Date;
  readonly endedAt: Date | null;
  readonly outcome: SessionOutcome | null;
};

export class Session {
  private constructor(private readonly props: SessionProps) {}

  static start(id: string, number: number, actor: Actor, now: Date): Session {
    return new Session({
      id,
      number,
      actor,
      startedAt: now,
      lastSeenAt: now,
      endedAt: null,
      outcome: null,
    });
  }

  static restore(props: SessionProps): Session {
    return new Session(props);
  }

  get id(): string {
    return this.props.id;
  }

  get number(): number {
    return this.props.number;
  }

  get actor(): Actor {
    return this.props.actor;
  }

  get startedAt(): Date {
    return this.props.startedAt;
  }

  get lastSeenAt(): Date {
    return this.props.lastSeenAt;
  }

  get endedAt(): Date | null {
    return this.props.endedAt;
  }

  get outcome(): SessionOutcome | null {
    return this.props.outcome;
  }

  get isEnded(): boolean {
    return this.props.endedAt !== null;
  }

  isLive(now: Date): boolean {
    return (
      !this.isEnded &&
      now.getTime() - this.props.lastSeenAt.getTime() < SESSION_LEASE_MS
    );
  }

  leaseEndsAt(): Date {
    return new Date(this.props.lastSeenAt.getTime() + SESSION_LEASE_MS);
  }

  touched(now: Date): Session {
    return new Session({ ...this.props, lastSeenAt: now });
  }

  ended(outcome: SessionOutcome, now: Date): Session {
    return new Session({
      ...this.props,
      lastSeenAt: now,
      endedAt: now,
      outcome,
    });
  }
}
