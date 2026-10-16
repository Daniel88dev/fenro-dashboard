import type { AnyCommand, Query } from "./messages";

export interface MessageTracer {
  traceCommand<T>(command: AnyCommand, handle: () => Promise<T>): Promise<T>;
  traceQuery<T>(query: Query, handle: () => Promise<T>): Promise<T>;
}

export const untracedMessages: MessageTracer = {
  traceCommand: (_command, handle) => handle(),
  traceQuery: (_query, handle) => handle(),
};
