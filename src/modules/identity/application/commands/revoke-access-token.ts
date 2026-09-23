import type {
  AccessTokenError,
  AccessTokenRepository,
} from "@/modules/identity/domain";
import type { Command, CommandHandler } from "@/shared/application";
import { err, ok, type Result } from "@/shared/domain";

export type RevokeAccessTokenCommand = Command<
  "identity.revoke-access-token",
  AccessTokenError
> & {
  readonly ownerId: string;
  readonly tokenId: string;
};

export function revokeAccessTokenCommand(
  ownerId: string,
  tokenId: string,
): RevokeAccessTokenCommand {
  return { type: "identity.revoke-access-token", ownerId, tokenId };
}

export class RevokeAccessTokenHandler implements CommandHandler<RevokeAccessTokenCommand> {
  constructor(
    private readonly tokens: AccessTokenRepository,
    private readonly clock: () => Date,
  ) {}

  async handle(
    command: RevokeAccessTokenCommand,
  ): Promise<Result<void, AccessTokenError>> {
    const token = await this.tokens.findById(command.tokenId);
    // Someone else's token is reported as missing, not as forbidden.
    if (!token || token.ownerId !== command.ownerId) {
      return err({
        code: "access-token-not-found",
        message: "That token does not exist.",
      });
    }
    token.revoke(this.clock());
    await this.tokens.save(token);
    return ok(undefined);
  }
}
