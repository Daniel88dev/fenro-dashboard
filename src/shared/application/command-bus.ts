import type { AnyCommand, CommandHandler, CommandOutcome } from "./messages";

/**
 * In-memory command dispatcher. Each command type has exactly one handler, so a
 * route handler or server action never reaches into a module's internals.
 */
export class CommandBus {
  readonly #handlers = new Map<string, CommandHandler<never>>();

  register<TCommand extends AnyCommand>(
    type: TCommand["type"],
    handler: CommandHandler<TCommand>,
  ): void {
    if (this.#handlers.has(type)) {
      throw new Error(`A handler is already registered for command "${type}".`);
    }
    this.#handlers.set(type, handler as CommandHandler<never>);
  }

  async dispatch<TCommand extends AnyCommand>(
    command: TCommand,
  ): Promise<CommandOutcome<TCommand>> {
    const handler = this.#handlers.get(command.type) as
      CommandHandler<TCommand> | undefined;
    if (!handler) {
      throw new Error(`No handler registered for command "${command.type}".`);
    }
    return handler.handle(command);
  }
}
