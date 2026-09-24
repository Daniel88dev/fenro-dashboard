import { describe, expect, it, vi } from "vitest";

import { err } from "@/shared/domain";

import { CommandBus } from "./command-bus";
import type { Command, Query } from "./messages";
import { QueryBus } from "./query-bus";

interface CreateTask extends Command<"tasks.create"> {
  readonly title: string;
}

interface CountTasks extends Query<"tasks.count", number> {
  readonly status: "open" | "done";
}

describe("CommandBus", () => {
  it("dispatches a command to its handler", async () => {
    const bus = new CommandBus();
    const handle = vi.fn();
    bus.register<CreateTask>("tasks.create", { handle });

    await bus.dispatch<CreateTask>({ type: "tasks.create", title: "Ship it" });

    expect(handle).toHaveBeenCalledWith({
      type: "tasks.create",
      title: "Ship it",
    });
  });

  it("refuses a second handler for the same command", () => {
    const bus = new CommandBus();
    bus.register<CreateTask>("tasks.create", { handle: vi.fn() });

    expect(() =>
      bus.register<CreateTask>("tasks.create", { handle: vi.fn() }),
    ).toThrow(/already registered/);
  });

  it("fails loudly when no handler is registered", async () => {
    const bus = new CommandBus();

    await expect(
      bus.dispatch<CreateTask>({ type: "tasks.create", title: "Ship it" }),
    ).rejects.toThrow(/No handler registered/);
  });

  it("hands back a refusal from a command that may be refused", async () => {
    const bus = new CommandBus();
    bus.register<ClaimTask>("tasks.claim", {
      handle: () => err({ code: "claimed" as const }),
    });

    const outcome = await bus.dispatch<ClaimTask>({
      type: "tasks.claim",
      taskId: "T-1",
    });

    expect(outcome).toEqual(err({ code: "claimed" }));
  });
});

interface ClaimTask extends Command<"tasks.claim", { code: "claimed" }> {
  readonly taskId: string;
}

describe("QueryBus", () => {
  it("returns the handler's result", async () => {
    const bus = new QueryBus();
    bus.register<CountTasks, number>("tasks.count", { handle: () => 3 });

    const query: CountTasks = { type: "tasks.count", status: "open" };
    const count = await bus.ask(query);

    expect(count).toBe(3);
  });

  it("fails loudly when no handler is registered", async () => {
    const bus = new QueryBus();

    const query: CountTasks = { type: "tasks.count", status: "open" };

    await expect(bus.ask(query)).rejects.toThrow(/No handler registered/);
  });
});
