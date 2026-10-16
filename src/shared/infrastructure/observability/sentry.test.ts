import { beforeEach, describe, expect, it, vi } from "vitest";

import { err, ok } from "@/shared/domain";

const sentry = vi.hoisted(() => {
  const span = { setAttribute: vi.fn() };
  return {
    span,
    startSpan: vi.fn((_options: unknown, run: (s: typeof span) => unknown) =>
      run(span),
    ),
    info: vi.fn(),
  };
});

vi.mock("@sentry/nextjs", () => ({
  startSpan: sentry.startSpan,
  logger: {
    info: sentry.info,
    fmt: (strings: TemplateStringsArray, ...values: unknown[]) =>
      String.raw(strings, ...values),
  },
}));

const { sentryMessageTracer } = await import("./sentry");

describe("sentryMessageTracer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("names a command's span after its type", async () => {
    await sentryMessageTracer.traceCommand({ type: "tasks.create" }, () =>
      Promise.resolve(undefined),
    );

    expect(sentry.startSpan).toHaveBeenCalledWith(
      expect.objectContaining({ name: "tasks.create", op: "cqrs.command" }),
      expect.any(Function),
    );
    expect(sentry.info).not.toHaveBeenCalled();
  });

  it("marks and logs a refused command, and hands the refusal back", async () => {
    const refusal = err({ code: "task_claimed", message: "Already claimed" });

    const outcome = await sentryMessageTracer.traceCommand(
      { type: "tasks.start" },
      () => Promise.resolve(refusal),
    );

    expect(outcome).toBe(refusal);
    expect(sentry.span.setAttribute).toHaveBeenCalledWith(
      "cqrs.refusal",
      "task_claimed",
    );
    expect(sentry.info).toHaveBeenCalledWith(
      "tasks.start refused: task_claimed",
    );
  });

  it("leaves a successful command unmarked", async () => {
    await sentryMessageTracer.traceCommand({ type: "tasks.update" }, () =>
      Promise.resolve(ok(undefined)),
    );

    expect(sentry.span.setAttribute).not.toHaveBeenCalled();
  });

  it("names a query's span after its type", async () => {
    const result = await sentryMessageTracer.traceQuery(
      { type: "tasks.list" },
      () => Promise.resolve(["T-1"]),
    );

    expect(result).toEqual(["T-1"]);
    expect(sentry.startSpan).toHaveBeenCalledWith(
      expect.objectContaining({ name: "tasks.list", op: "cqrs.query" }),
      expect.any(Function),
    );
  });
});
