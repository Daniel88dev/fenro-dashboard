import type { Actor } from "./actor";

/** How long a session holds its task after the agent was last heard from. */
export const SESSION_LEASE_MS = 2 * 60 * 60 * 1000;

export const SESSION_OUTCOMES = [
  "done",
  "in_review",
  "paused",
  "blocked",
  "released",
] as const;

/** What the agent says it left behind when it finished. */
export type FinishOutcome = (typeof SESSION_OUTCOMES)[number];

/**
 * How a session ended: one of the outcomes an agent chooses, or one the task
 * imposed — someone else took over a session that had lapsed, or the task was
 * cancelled or finished around it.
 */
export type SessionOutcome = FinishOutcome | "lapsed" | "cancelled";

export type SessionProps = {
  readonly id: string;
  /** 1 for the first session on the task: "Session 3 running". */
  readonly number: number;
  readonly actor: Actor;
  readonly startedAt: Date;
  readonly lastSeenAt: Date;
  readonly endedAt: Date | null;
  readonly outcome: SessionOutcome | null;
};

/**
 * One agent's stint on a task: its claim, and the unit a handoff is written
 * for. An entity inside `Task` rather than an aggregate of its own, because the
 * rule that decides it — one live session per task — is the task's to keep.
 *
 * Immutable: the task replaces a session to change it.
 */
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

  /** Still holding the task: not ended, and heard from within the lease. */
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
