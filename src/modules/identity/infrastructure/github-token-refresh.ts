import type { OAuth2Tokens } from "better-auth/oauth2";
import { z } from "zod";

const TOKEN_ENDPOINT = "https://github.com/login/oauth/access_token";

const refreshed = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().optional(),
  token_type: z.string().optional(),
  expires_in: z.number().optional(),
  refresh_token_expires_in: z.number().optional(),
});

const refused = z.object({
  error: z.string(),
  error_description: z.string().optional(),
});

type Fetch = typeof fetch;

/**
 * Trades a GitHub App refresh token for a new pair. GitHub answers a refused
 * refresh (expired, revoked, or already spent by another request) with a 200
 * and an `error` field, so this throws on that rather than handing Better Auth
 * a token-less answer to store. Better Auth turns the throw into "no token",
 * and the viewer is asked to sign in again.
 */
export async function refreshGitHubToken(
  refreshToken: string,
  client: { readonly clientId: string; readonly clientSecret: string },
  fetchImpl: Fetch = fetch,
  now: () => Date = () => new Date(),
): Promise<OAuth2Tokens> {
  const response = await fetchImpl(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: client.clientId,
      client_secret: client.clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  });

  const body: unknown = await response.json().catch(() => null);
  const failure = refused.safeParse(body);
  if (!response.ok || failure.success) {
    const reason = failure.success
      ? (failure.data.error_description ?? failure.data.error)
      : `status ${response.status}`;
    throw new Error(`GitHub refused to refresh the token: ${reason}`);
  }

  const tokens = refreshed.parse(body);
  const at = now().getTime();
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    tokenType: tokens.token_type,
    accessTokenExpiresAt: tokens.expires_in
      ? new Date(at + tokens.expires_in * 1000)
      : undefined,
    refreshTokenExpiresAt: tokens.refresh_token_expires_in
      ? new Date(at + tokens.refresh_token_expires_in * 1000)
      : undefined,
  };
}
