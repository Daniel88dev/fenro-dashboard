import { AggregateRoot, err, ok, UniqueId, type Result } from "@/shared/domain";

/**
 * What a token lets an agent do. The same strings will name the OAuth scopes
 * if agents later sign in through OAuth, so a token and an OAuth grant mean
 * the same thing to the MCP server.
 */
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

/** Every token expires; a year is the longest anyone may ask for. */
export const MAX_LIFETIME_DAYS = 366;
export const NAME_LIMIT = 60;

/** How often a token's last use is written down. */
const USE_RECORDING_INTERVAL_MS = 5 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

type Props = {
  readonly ownerId: string;
  /** What the person called it: "Claude Code on my laptop". */
  readonly name: string;
  readonly scopes: readonly AccessScope[];
  /** SHA-256 of the secret. The secret itself is shown once and never kept. */
  readonly secretHash: string;
  /** The secret's last four characters, so a person can tell tokens apart. */
  readonly hint: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
};

type Usage = {
  readonly lastUsedAt: Date | null;
  readonly revokedAt: Date | null;
};

/**
 * A personal access token an agent presents to the MCP server, standing in for
 * the person who issued it. Each token is an agent's identity too: an agent's
 * session on a task belongs to the token it started with.
 */
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

  /**
   * Note that the token was used, at most every few minutes: an agent calls
   * the server many times a minute, and "last used" only needs to answer
   * "is this token still in use?". True when something changed.
   */
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
