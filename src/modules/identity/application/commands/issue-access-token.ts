import {
  AccessToken,
  accessTokenHint,
  hashAccessTokenSecret,
  type AccessTokenError,
  type AccessTokenRepository,
} from "@/modules/identity/domain";
import type { Command, CommandHandler } from "@/shared/application";
import { ok, type Result } from "@/shared/domain";

/**
 * Issue a token for an agent. The caller generates the id and the secret, so
 * it can show the secret once without the command returning anything; only
 * its hash is kept.
 */
export type IssueAccessTokenCommand = Command<
  "identity.issue-access-token",
  AccessTokenError
> & {
  readonly tokenId: string;
  readonly ownerId: string;
  readonly name: string;
  readonly scopes: readonly string[];
  readonly lifetimeDays: number;
  readonly secret: string;
};

export function issueAccessTokenCommand(
  input: Omit<IssueAccessTokenCommand, "type" | "__refusal">,
): IssueAccessTokenCommand {
  return { type: "identity.issue-access-token", ...input };
}

export class IssueAccessTokenHandler implements CommandHandler<IssueAccessTokenCommand> {
  constructor(
    private readonly tokens: AccessTokenRepository,
    private readonly clock: () => Date,
  ) {}

  async handle(
    command: IssueAccessTokenCommand,
  ): Promise<Result<void, AccessTokenError>> {
    const issued = AccessToken.issue({
      id: command.tokenId,
      ownerId: command.ownerId,
      name: command.name,
      scopes: command.scopes,
      secretHash: await hashAccessTokenSecret(command.secret),
      hint: accessTokenHint(command.secret),
      lifetimeDays: command.lifetimeDays,
      now: this.clock(),
    });
    if (!issued.ok) return issued;
    await this.tokens.save(issued.value);
    return ok(undefined);
  }
}
