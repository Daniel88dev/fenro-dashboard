import {
  createMcpHandler,
  localhostAllowedOrigins,
  OAuthError,
  OAuthErrorCode,
  originValidationResponse,
  requireBearerAuth,
  type AuthInfo,
  type OAuthTokenVerifier,
} from "@modelcontextprotocol/server";

import { recordAccessTokenUseCommand } from "@/modules/identity/application/commands/record-access-token-use";
import { authenticateAgentQuery } from "@/modules/identity/application/queries/authenticate-agent";
import {
  createTasksMcpServer,
  type AgentAccess,
} from "@/modules/tasks/ui/mcp/tasks-mcp-server";
import { getEnv } from "@/shared/config/env";
import { getAgentContainer } from "@/shared/infrastructure/container";

/**
 * The MCP server agents connect to, over Streamable HTTP and stateless: every
 * request stands alone, so any instance on any host can answer it.
 *
 *   claude mcp add --transport http fenro <APP_URL>/api/mcp \
 *     --header "Authorization: Bearer fenro_pat_…"
 *
 * The route only authenticates. The token names the person and the agent,
 * and the tasks context's MCP server does the rest through the buses.
 */
const mcp = createMcpHandler(
  ({ authInfo }) =>
    createTasksMcpServer(toAccess(authInfo!), getAgentContainer()),
  // No tool here streams progress, so clients on the current protocol get a
  // single JSON body; older clients still get the SSE framing they expect.
  { responseMode: "json" },
);

async function handle(request: Request): Promise<Response> {
  // A web page must not drive an agent's tools with a visitor's browser.
  const foreignOrigin = originValidationResponse(request, [
    new URL(getEnv().APP_URL).hostname,
    ...localhostAllowedOrigins(),
  ]);
  if (foreignOrigin) return foreignOrigin;

  const { queryBus, commandBus } = getAgentContainer();
  const verifier: OAuthTokenVerifier = {
    async verifyAccessToken(token) {
      const agent = await queryBus.ask(authenticateAgentQuery(token));
      if (!agent.ok) {
        throw new OAuthError(OAuthErrorCode.InvalidToken, agent.error.message);
      }
      await commandBus.dispatch(
        recordAccessTokenUseCommand(agent.value.tokenId),
      );
      return {
        token,
        clientId: `token:${agent.value.tokenId}`,
        scopes: [...agent.value.scopes],
        expiresAt: Math.floor(agent.value.expiresAt.getTime() / 1000),
        extra: {
          ownerId: agent.value.ownerId,
          tokenId: agent.value.tokenId,
          name: agent.value.name,
        },
      };
    },
  };

  const auth = await requireBearerAuth({
    verifier,
    requiredScopes: ["tasks:read"],
  })(request);
  if (auth instanceof Response) return auth;

  return mcp.fetch(request, { authInfo: auth });
}

function toAccess(auth: AuthInfo): AgentAccess {
  const { ownerId, tokenId, name } = auth.extra as {
    ownerId: string;
    tokenId: string;
    name: string;
  };
  return {
    ownerId,
    actor: { kind: "agent", id: tokenId, name },
    canWrite: auth.scopes.includes("tasks:write"),
  };
}

export { handle as DELETE, handle as GET, handle as POST };
