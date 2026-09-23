import type {
  AccessScope,
  AccessTokenRepository,
} from "@/modules/identity/domain";
import type { Query, QueryHandler } from "@/shared/application";

export type AccessTokenSummary = {
  readonly id: string;
  readonly name: string;
  readonly scopes: readonly AccessScope[];
  /** The secret's last four characters. */
  readonly hint: string;
  readonly state: "active" | "expired" | "revoked";
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly lastUsedAt: string | null;
};

/** The signed-in person's tokens, newest first, for the settings page. */
export type AccessTokensQuery = Query<
  "identity.access-tokens",
  AccessTokenSummary[]
> & { readonly ownerId: string };

export function accessTokensQuery(ownerId: string): AccessTokensQuery {
  return { type: "identity.access-tokens", ownerId };
}

export class AccessTokensHandler implements QueryHandler<
  AccessTokensQuery,
  AccessTokenSummary[]
> {
  constructor(
    private readonly tokens: AccessTokenRepository,
    private readonly clock: () => Date,
  ) {}

  async handle(query: AccessTokensQuery): Promise<AccessTokenSummary[]> {
    const now = this.clock();
    const tokens = await this.tokens.listFor(query.ownerId);
    return tokens.map((token) => ({
      id: token.id.value,
      name: token.name,
      scopes: token.scopes,
      hint: token.hint,
      state: token.revokedAt
        ? "revoked"
        : token.isUsable(now)
          ? "active"
          : "expired",
      createdAt: token.createdAt.toISOString(),
      expiresAt: token.expiresAt.toISOString(),
      lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
    }));
  }
}
