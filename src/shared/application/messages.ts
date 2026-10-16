import type { Result } from "@/shared/domain";

// `TRefusal` is a phantom field so `CommandBus.dispatch` can infer it.
export interface Command<TType extends string = string, TRefusal = never> {
  readonly type: TType;
  readonly __refusal?: TRefusal;
}

// `TResult` is a phantom field so `QueryBus.ask` can infer the return type.
export interface Query<TType extends string = string, TResult = unknown> {
  readonly type: TType;
  readonly __result?: TResult;
}

export type AnyCommand = Command<string, unknown>;

type RefusalOf<TCommand extends AnyCommand> = Exclude<
  TCommand["__refusal"],
  undefined
>;

export type CommandOutcome<TCommand extends AnyCommand> = [
  RefusalOf<TCommand>,
] extends [never]
  ? void
  : Result<void, RefusalOf<TCommand>>;

export interface CommandHandler<TCommand extends AnyCommand> {
  handle(
    command: TCommand,
  ): Promise<CommandOutcome<TCommand>> | CommandOutcome<TCommand>;
}

export interface QueryHandler<TQuery extends Query, TResult> {
  handle(query: TQuery): Promise<TResult> | TResult;
}
