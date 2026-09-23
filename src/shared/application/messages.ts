import type { Result } from "@/shared/domain";

/**
 * Intent to change state. Named in the imperative: `tasks.create`.
 *
 * A command returns no data. When the domain may refuse it — a task that is
 * already claimed, a dependency that would close a cycle — `TRefusal` names
 * why, and the handler answers `Result<void, TRefusal>` instead of nothing, so
 * an expected refusal comes back as a value rather than a throw. It is carried
 * as a phantom field, like a query's result, so `CommandBus.dispatch` can infer
 * it. Commands that cannot be refused leave it `never` and return nothing.
 */
export interface Command<TType extends string = string, TRefusal = never> {
  readonly type: TType;
  readonly __refusal?: TRefusal;
}

/**
 * Request for data. `TResult` is carried as a phantom field so `QueryBus.ask`
 * can infer the return type from the query itself.
 */
export interface Query<TType extends string = string, TResult = unknown> {
  readonly type: TType;
  readonly __result?: TResult;
}

/** Any command, whatever it may be refused with. */
export type AnyCommand = Command<string, unknown>;

type RefusalOf<TCommand extends AnyCommand> = Exclude<
  TCommand["__refusal"],
  undefined
>;

/** What handling `TCommand` answers: nothing, or whether it was refused. */
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
