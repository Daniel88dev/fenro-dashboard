/** Intent to change state. Named in the imperative: `tasks.create`. */
export interface Command<TType extends string = string> {
  readonly type: TType;
}

/**
 * Request for data. `TResult` is carried as a phantom field so `QueryBus.ask`
 * can infer the return type from the query itself.
 */
export interface Query<TType extends string = string, TResult = unknown> {
  readonly type: TType;
  readonly __result?: TResult;
}

export interface CommandHandler<TCommand extends Command> {
  handle(command: TCommand): Promise<void> | void;
}

export interface QueryHandler<TQuery extends Query, TResult> {
  handle(query: TQuery): Promise<TResult> | TResult;
}
