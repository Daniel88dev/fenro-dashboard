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
import { myGroupsQuery } from "@/modules/groups/application/queries/my-groups";
import { personalSpace, type TaskSpace } from "@/modules/tasks/domain";
import {
  createTasksMcpServer,
  type AgentAccess,
} from "@/modules/tasks/ui/mcp/tasks-mcp-server";
import { getEnv } from "@/shared/config/env";
import { getAgentContainer } from "@/shared/infrastructure/container";

// Stateless, so any instance on any host can answer any request.
const mcp = createMcpHandler(
  ({ authInfo }) =>
    createTasksMcpServer(toAccess(authInfo!), getAgentContainer(), {
      upload: (ticket) =>
        new URL(`/api/pictures/upload/${ticket}`, getEnv().APP_URL).href,
      task: (key) => new URL(`/tasks/${key}`, getEnv().APP_URL).href,
    }),
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
      const { groups } = await queryBus.ask(
        myGroupsQuery({ id: agent.value.ownerId, login: "" }),
      );
      return {
        token,
        clientId: `token:${agent.value.tokenId}`,
        scopes: [...agent.value.scopes],
        expiresAt: Math.floor(agent.value.expiresAt.getTime() / 1000),
        extra: {
          ownerId: agent.value.ownerId,
          spaces: [
            personalSpace(agent.value.ownerId),
            ...groups.map((group): TaskSpace => ({
              ownerId: group.id,
              prefix: group.prefix,
              name: group.name,
              kind: "group",
            })),
          ],
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
  const { ownerId, spaces, tokenId, name } = auth.extra as {
    ownerId: string;
    spaces: readonly TaskSpace[];
    tokenId: string;
    name: string;
  };
  return {
    ownerId,
    spaces,
    actor: { kind: "agent", id: tokenId, name },
    canWrite: auth.scopes.includes("tasks:write"),
  };
}

export { handle as DELETE, handle as GET, handle as POST };
