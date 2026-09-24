/**
 * The secret an agent sends as `Authorization: Bearer fenro_pat_…`. The prefix
 * makes a leaked token recognisable to secret scanners, and tells it apart
 * from an OAuth access token if the MCP server ever accepts both.
 *
 * Only Web Crypto globals are used, so this runs the same in Node, a browser
 * and a test.
 */
export const ACCESS_TOKEN_PREFIX = "fenro_pat_";

const SECRET_BYTES = 32;
const SHAPE = /^fenro_pat_[A-Za-z0-9_-]{43}$/;

export function generateAccessTokenSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(SECRET_BYTES));
  return `${ACCESS_TOKEN_PREFIX}${toBase64Url(bytes)}`;
}

export function looksLikeAccessToken(value: string): boolean {
  return SHAPE.test(value);
}

/**
 * A fast hash is right here: the secret is 256 random bits, not a password
 * someone chose, so there is nothing for a slow hash to protect against.
 */
export async function hashAccessTokenSecret(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function accessTokenHint(secret: string): string {
  return secret.slice(-4);
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
