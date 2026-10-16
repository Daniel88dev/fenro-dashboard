import * as Sentry from "@sentry/nextjs";

import type { MessageTracer } from "@/shared/application";
import { getEnv } from "@/shared/config/env";

import { serverSentryOptions } from "./sentry-options";

/**
 * Starts the SDK in the server or edge runtime. `@sentry/nextjs` resolves to
 * the build for whichever runtime imports it, so both share this.
 */
export function initSentry(): void {
  const options = serverSentryOptions(getEnv());
  if (!options) return;
  Sentry.init({
    ...options,
    // The adapters report trouble with console.warn and console.error; those
    // become searchable logs, tied to the trace they happened in.
    integrations: [
      Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }),
    ],
  });
}

/** Each command and query becomes a span named by its type. */
export const sentryMessageTracer: MessageTracer = {
  traceCommand: (command, handle) =>
    Sentry.startSpan(
      { name: command.type, op: "cqrs.command", onlyIfParent: true },
      async (span) => {
        const outcome = await handle();
        const refusal = refusalOf(outcome);
        if (refusal !== undefined) {
          span.setAttribute("cqrs.refusal", refusal);
          Sentry.logger.info(
            Sentry.logger.fmt`${command.type} refused: ${refusal}`,
          );
        }
        return outcome;
      },
    ),
  traceQuery: (query, handle) =>
    Sentry.startSpan(
      { name: query.type, op: "cqrs.query", onlyIfParent: true },
      handle,
    ),
};

/** A refused command answers `err(...)`; name the refusal by its code. */
function refusalOf(outcome: unknown): string | undefined {
  if (typeof outcome !== "object" || outcome === null) return undefined;
  if (!("ok" in outcome) || outcome.ok !== false) return undefined;
  const error = (outcome as { error?: unknown }).error;
  if (typeof error === "object" && error !== null) {
    if ("code" in error && typeof error.code === "string") return error.code;
    if (error instanceof Error) return error.message;
  }
  return String(error);
}
