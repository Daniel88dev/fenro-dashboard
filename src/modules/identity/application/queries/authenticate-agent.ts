import {
  hashAccessTokenSecret,
  looksLikeAccessToken,
  type AccessScope,
  type AccessTokenError,
  type AccessTokenRepository,
} from "@/modules/identity/domain";
import type { Query, QueryHandler } from "@/shared/application";
import { err, ok, type Result } from "@/shared/domain";

/** Who an agent is, once its token checks out. */
export type AgentPrincipal = {
  readonly tokenId: string;
  /** The person the agent acts for. */
  readonly ownerId: string;
  /** The token's name, which is how the agent is shown on its tasks. */
  readonly name: string;
  readonly scopes: readonly AccessScope[];
  readonly expiresAt: Date;
};

export type AuthenticateAgentResult = Result<AgentPrincipal, AccessTokenError>;

export type AuthenticateAgentQuery = Query<
  "identity.authenticate-agent",
  AuthenticateAgentResult
> & { readonly secret: string };

export function authenticateAgentQuery(secret: string): AuthenticateAgentQuery {
  return { type: "identity.authenticate-agent", secret };
}

/**
 * Unknown, revoked and expired tokens get the same answer, so a caller learns
 * nothing about which tokens exist.
 */
export class AuthenticateAgentHandler implements QueryHandler<
  AuthenticateAgentQuery,
  AuthenticateAgentResult
> {
  constructor(
    private readonly tokens: AccessTokenRepository,
    private readonly clock: () => Date,
  ) {}

  async handle(
    query: AuthenticateAgentQuery,
  ): Promise<AuthenticateAgentResult> {
    const refused = err({
      code: "invalid-access-token" as const,
      message: "The access token is unknown, revoked or expired.",
    });
    if (!looksLikeAccessToken(query.secret)) return refused;

    const token = await this.tokens.findBySecretHash(
      await hashAccessTokenSecret(query.secret),
    );
    if (!token || !token.isUsable(this.clock())) return refused;

    return ok({
      tokenId: token.id.value,
      ownerId: token.ownerId,
      name: token.name,
      scopes: token.scopes,
      expiresAt: token.expiresAt,
    });
  }
}
