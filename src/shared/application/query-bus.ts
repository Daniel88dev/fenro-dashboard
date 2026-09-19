import type { Query, QueryHandler } from "./messages";

/**
 * In-memory query dispatcher. Read models are served from here, so they can be
 * built independently of the write side.
 */
export class QueryBus {
  readonly #handlers = new Map<string, QueryHandler<never, unknown>>();

  register<TQuery extends Query<string, TResult>, TResult>(
    type: TQuery["type"],
    handler: QueryHandler<TQuery, TResult>,
  ): void {
    if (this.#handlers.has(type)) {
      throw new Error(`A handler is already registered for query "${type}".`);
    }
    this.#handlers.set(type, handler as QueryHandler<never, unknown>);
  }

  async ask<TResult>(query: Query<string, TResult>): Promise<TResult> {
    const handler = this.#handlers.get(query.type) as
      QueryHandler<typeof query, TResult> | undefined;
    if (!handler) {
      throw new Error(`No handler registered for query "${query.type}".`);
    }
    return handler.handle(query);
  }
}
