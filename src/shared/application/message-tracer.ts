import type { AnyCommand, Query } from "./messages";

/**
 * Watches every command and query on its way through a bus, so tracing and
 * logging see the application's own vocabulary (`tasks.create`) without a
 * handler knowing they exist. The adapter lives in infrastructure.
 */
export interface MessageTracer {
  traceCommand<T>(command: AnyCommand, handle: () => Promise<T>): Promise<T>;
  traceQuery<T>(query: Query, handle: () => Promise<T>): Promise<T>;
}

/** The default: handlers run as they are. */
export const untracedMessages: MessageTracer = {
  traceCommand: (_command, handle) => handle(),
  traceQuery: (_query, handle) => handle(),
};
