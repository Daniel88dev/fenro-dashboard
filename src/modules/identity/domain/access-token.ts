import { AggregateRoot, err, ok, UniqueId, type Result } from "@/shared/domain";

export const ACCESS_SCOPES = ["tasks:read", "tasks:write"] as const;

export type AccessScope = (typeof ACCESS_SCOPES)[number];

export function isAccessScope(value: string): value is AccessScope {
  return (ACCESS_SCOPES as readonly string[]).includes(value);
}

export type AccessTokenError = {
  readonly code: "invalid-access-token" | "access-token-not-found";
  readonly message: string;
};

function invalid(message: string): AccessTokenError {
  return { code: "invalid-access-token", message };
}

export const MAX_LIFETIME_DAYS = 366;
export const NAME_LIMIT = 60;

const USE_RECORDING_INTERVAL_MS = 5 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

type Props = {
  readonly ownerId: string;
  readonly name: string;
  readonly scopes: readonly AccessScope[];
  readonly secretHash: string;
  readonly hint: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
};

type Usage = {
  readonly lastUsedAt: Date | null;
  readonly revokedAt: Date | null;
};

export class AccessToken extends AggregateRoot<Props> {
  #usage: Usage;

  private constructor(id: UniqueId, props: Props, usage: Usage) {
    super(id, props);
    this.#usage = usage;
  }

  static issue(input: {
    readonly id: string;
    readonly ownerId: string;
    readonly name: string;
    readonly scopes: readonly string[];
    readonly secretHash: string;
    readonly hint: string;
    readonly lifetimeDays: number;
    readonly now: Date;
  }): Result<AccessToken, AccessTokenError> {
    const name = input.name.trim().replace(/\s+/g, " ");
    if (!name) return err(invalid("Give the token a name you will recognise."));
    if (name.length > NAME_LIMIT) {
      return err(invalid(`Keep the name under ${NAME_LIMIT} characters.`));
    }

    // Changing a task means reading it first, so write brings read with it.
    const wanted = input.scopes.includes("tasks:write")
      ? [...input.scopes, "tasks:read"]
      : input.scopes;
    const scopes = ACCESS_SCOPES.filter((scope) => wanted.includes(scope));
    const unknown = input.scopes.filter((scope) => !isAccessScope(scope));
    if (unknown.length > 0) {
      return err(invalid(`Unknown scope: ${unknown.join(", ")}.`));
    }
    if (scopes.length === 0) {
      return err(invalid("A token needs at least one scope."));
    }

    const days = Math.floor(input.lifetimeDays);
    if (!(days >= 1 && days <= MAX_LIFETIME_DAYS)) {
      return err(
        invalid(`A token lasts between 1 and ${MAX_LIFETIME_DAYS} days.`),
      );
    }

    return ok(
      new AccessToken(
        UniqueId.create(input.id),
        {
          ownerId: input.ownerId,
          name,
          scopes,
          secretHash: input.secretHash,
          hint: input.hint,
          createdAt: input.now,
          expiresAt: new Date(input.now.getTime() + days * DAY_MS),
        },
        { lastUsedAt: null, revokedAt: null },
      ),
    );
  }

  static restore(id: UniqueId, props: Props, usage: Usage): AccessToken {
    return new AccessToken(id, props, usage);
  }

  isUsable(now: Date): boolean {
    return this.#usage.revokedAt === null && now < this.props.expiresAt;
  }

  revoke(now: Date): void {
    if (this.#usage.revokedAt) return;
    this.#usage = { ...this.#usage, revokedAt: now };
  }

  // Written at most every few minutes: an agent calls the server many times a
  // minute, and "last used" only needs to say whether the token is in use.
  recordUse(now: Date): boolean {
    const last = this.#usage.lastUsedAt;
    if (last && now.getTime() - last.getTime() < USE_RECORDING_INTERVAL_MS) {
      return false;
    }
    this.#usage = { ...this.#usage, lastUsedAt: now };
    return true;
  }

  get ownerId(): string {
    return this.props.ownerId;
  }

  get name(): string {
    return this.props.name;
  }

  get scopes(): readonly AccessScope[] {
    return this.props.scopes;
  }

  get secretHash(): string {
    return this.props.secretHash;
  }

  get hint(): string {
    return this.props.hint;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get lastUsedAt(): Date | null {
    return this.#usage.lastUsedAt;
  }

  get revokedAt(): Date | null {
    return this.#usage.revokedAt;
  }
}
