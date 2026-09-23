import type { AccessTokenRepository } from "@/modules/identity/domain";
import type { Command, CommandHandler } from "@/shared/application";

export type RecordAccessTokenUseCommand =
  Command<"identity.record-access-token-use"> & {
    readonly tokenId: string;
  };

export function recordAccessTokenUseCommand(
  tokenId: string,
): RecordAccessTokenUseCommand {
  return { type: "identity.record-access-token-use", tokenId };
}

export class RecordAccessTokenUseHandler implements CommandHandler<RecordAccessTokenUseCommand> {
  constructor(
    private readonly tokens: AccessTokenRepository,
    private readonly clock: () => Date,
  ) {}

  async handle(command: RecordAccessTokenUseCommand): Promise<void> {
    const token = await this.tokens.findById(command.tokenId);
    if (token?.recordUse(this.clock())) await this.tokens.save(token);
  }
}
