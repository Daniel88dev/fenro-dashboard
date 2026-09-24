import { beforeEach, describe, expect, it } from "vitest";

import { generateAccessTokenSecret } from "@/modules/identity/domain";
import { InMemoryAccessTokenRepository } from "@/modules/identity/infrastructure/in-memory-access-token.repository";

import {
  IssueAccessTokenHandler,
  issueAccessTokenCommand,
} from "./commands/issue-access-token";
import { RecordAccessTokenUseHandler } from "./commands/record-access-token-use";
import {
  RevokeAccessTokenHandler,
  revokeAccessTokenCommand,
} from "./commands/revoke-access-token";
import {
  AccessTokensHandler,
  accessTokensQuery,
} from "./queries/access-tokens";
import {
  AuthenticateAgentHandler,
  authenticateAgentQuery,
} from "./queries/authenticate-agent";

const TOKEN_ID = "4a1f1a0e-3a52-4b8e-9f4c-1c2d3e4f5a6b";

let now: Date;
let tokens: InMemoryAccessTokenRepository;
const clock = () => now;

beforeEach(() => {
  now = new Date("2026-09-23T10:00:00Z");
  tokens = new InMemoryAccessTokenRepository();
});

async function issue(secret: string, scopes = ["tasks:read", "tasks:write"]) {
  const result = await new IssueAccessTokenHandler(tokens, clock).handle(
    issueAccessTokenCommand({
      tokenId: TOKEN_ID,
      ownerId: "user-1",
      name: "Claude Code",
      scopes,
      lifetimeDays: 30,
      secret,
    }),
  );
  expect(result.ok).toBe(true);
}

const authenticate = (secret: string) =>
  new AuthenticateAgentHandler(tokens, clock).handle(
    authenticateAgentQuery(secret),
  );

describe("agent access tokens", () => {
  it("let an agent in as the person who issued them", async () => {
    const secret = generateAccessTokenSecret();
    await issue(secret);

    const agent = await authenticate(secret);
    expect(agent.ok && agent.value).toMatchObject({
      tokenId: TOKEN_ID,
      ownerId: "user-1",
      name: "Claude Code",
      scopes: ["tasks:read", "tasks:write"],
    });
  });

  it("keep only a hash of the secret", async () => {
    const secret = generateAccessTokenSecret();
    await issue(secret);

    const token = await tokens.findById(TOKEN_ID);
    expect(token?.secretHash).not.toContain(secret.slice(10));
    expect(token?.hint).toBe(secret.slice(-4));
  });

  it("refuse unknown, revoked and expired secrets alike", async () => {
    const secret = generateAccessTokenSecret();
    await issue(secret);

    const unknown = await authenticate(generateAccessTokenSecret());
    expect(unknown.ok).toBe(false);

    now = new Date("2026-10-24T10:00:00Z");
    const expired = await authenticate(secret);
    expect(!expired.ok && expired.error).toEqual(!unknown.ok && unknown.error);
  });

  it("can be revoked by their owner only", async () => {
    const secret = generateAccessTokenSecret();
    await issue(secret);
    const revoke = new RevokeAccessTokenHandler(tokens, clock);

    const stranger = await revoke.handle(
      revokeAccessTokenCommand("user-2", TOKEN_ID),
    );
    expect(!stranger.ok && stranger.error.code).toBe("access-token-not-found");
    expect((await authenticate(secret)).ok).toBe(true);

    await revoke.handle(revokeAccessTokenCommand("user-1", TOKEN_ID));
    expect((await authenticate(secret)).ok).toBe(false);

    const listed = await new AccessTokensHandler(tokens, clock).handle(
      accessTokensQuery("user-1"),
    );
    expect(listed.map((token) => token.state)).toEqual(["revoked"]);
  });

  it("show when they were last used", async () => {
    await issue(generateAccessTokenSecret());
    await new RecordAccessTokenUseHandler(tokens, clock).handle({
      type: "identity.record-access-token-use",
      tokenId: TOKEN_ID,
    });

    const [listed] = await new AccessTokensHandler(tokens, clock).handle(
      accessTokensQuery("user-1"),
    );
    expect(listed).toMatchObject({
      state: "active",
      lastUsedAt: "2026-09-23T10:00:00.000Z",
      expiresAt: "2026-10-23T10:00:00.000Z",
    });
  });
});
