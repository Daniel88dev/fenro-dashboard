import {
  InMemoryTransport,
  LATEST_PROTOCOL_VERSION,
  type JSONRPCMessage,
} from "@modelcontextprotocol/server";
import { beforeEach, describe, expect, it } from "vitest";

import {
  ChangeStatusHandler,
  type ChangeStatusCommand,
} from "@/modules/tasks/application/commands/change-status";
import {
  CheckCriterionHandler,
  type CheckCriterionCommand,
} from "@/modules/tasks/application/commands/check-criterion";
import {
  CreateTaskHandler,
  type CreateTaskCommand,
} from "@/modules/tasks/application/commands/create-task";
import {
  FinishSessionHandler,
  type FinishSessionCommand,
} from "@/modules/tasks/application/commands/finish-session";
import {
  LinkTasksHandler,
  type LinkTasksCommand,
} from "@/modules/tasks/application/commands/link-tasks";
import {
  RecordNoteHandler,
  type RecordNoteCommand,
} from "@/modules/tasks/application/commands/record-note";
import {
  StartTaskHandler,
  type StartTaskCommand,
} from "@/modules/tasks/application/commands/start-task";
import {
  UpdateTaskHandler,
  type UpdateTaskCommand,
} from "@/modules/tasks/application/commands/update-task";
import {
  ListTasksHandler,
  type ListTasksQuery,
} from "@/modules/tasks/application/queries/list-tasks";
import type {
  TaskBrief,
  TaskList,
} from "@/modules/tasks/application/queries/read-models";
import {
  TaskBriefHandler,
  type TaskBriefQuery,
  type TaskBriefResult,
} from "@/modules/tasks/application/queries/task-brief";
import { InMemoryTaskStore } from "@/modules/tasks/infrastructure/in-memory-task.store";
import { CommandBus, QueryBus } from "@/shared/application";

import { createTasksMcpServer, type AgentAccess } from "./tasks-mcp-server";

const OWNER = "user-1";

let now: Date;
let store: InMemoryTaskStore;

function buses() {
  const clock = () => now;
  const commandBus = new CommandBus();
  commandBus.register<CreateTaskCommand>(
    "tasks.create-task",
    new CreateTaskHandler(store, clock),
  );
  commandBus.register<UpdateTaskCommand>(
    "tasks.update-task",
    new UpdateTaskHandler(store, clock),
  );
  commandBus.register<StartTaskCommand>(
    "tasks.start-task",
    new StartTaskHandler(store, clock),
  );
  commandBus.register<FinishSessionCommand>(
    "tasks.finish-session",
    new FinishSessionHandler(store, clock),
  );
  commandBus.register<RecordNoteCommand>(
    "tasks.record-note",
    new RecordNoteHandler(store, clock),
  );
  commandBus.register<CheckCriterionCommand>(
    "tasks.check-criterion",
    new CheckCriterionHandler(store, clock),
  );
  commandBus.register<LinkTasksCommand>(
    "tasks.link-tasks",
    new LinkTasksHandler(store, clock),
  );
  commandBus.register<ChangeStatusCommand>(
    "tasks.change-status",
    new ChangeStatusHandler(store, clock),
  );
  const queryBus = new QueryBus();
  queryBus.register<ListTasksQuery, TaskList>(
    "tasks.list-tasks",
    new ListTasksHandler(store, clock),
  );
  queryBus.register<TaskBriefQuery, TaskBriefResult>(
    "tasks.task-brief",
    new TaskBriefHandler(store, clock),
  );
  return { commandBus, queryBus };
}

type ToolAnswer = { text: string; isError: boolean };

/**
 * A bare JSON-RPC client over the SDK's in-memory transport: the agent's side
 * of the conversation, without pulling in the client package for a test.
 */
async function connect(access: AgentAccess) {
  const [agentSide, serverSide] = InMemoryTransport.createLinkedPair();
  const pending = new Map<number, (message: JSONRPCMessage) => void>();
  agentSide.onmessage = (message) => {
    if ("id" in message && typeof message.id === "number") {
      pending.get(message.id)?.(message);
    }
  };
  await createTasksMcpServer(access, buses()).connect(serverSide);
  await agentSide.start();

  let nextId = 0;
  const request = async (method: string, params: Record<string, unknown>) => {
    const id = (nextId += 1);
    const answered = new Promise<JSONRPCMessage>((resolve) =>
      pending.set(id, resolve),
    );
    await agentSide.send({ jsonrpc: "2.0", id, method, params });
    const message = (await answered) as {
      result?: Record<string, unknown>;
      error?: { message: string };
    };
    if (message.error) throw new Error(message.error.message);
    return message.result!;
  };

  await request("initialize", {
    protocolVersion: LATEST_PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: "test-agent", version: "1.0.0" },
  });
  await agentSide.send({
    jsonrpc: "2.0",
    method: "notifications/initialized",
  });

  return {
    async tools(): Promise<string[]> {
      const result = (await request("tools/list", {})) as {
        tools: { name: string }[];
      };
      return result.tools.map((tool) => tool.name);
    },
    async prompts(): Promise<string[]> {
      const result = (await request("prompts/list", {})) as {
        prompts: { name: string }[];
      };
      return result.prompts.map((prompt) => prompt.name);
    },
    async prompt(
      name: string,
      args: Record<string, string> = {},
    ): Promise<string> {
      const result = (await request("prompts/get", {
        name,
        arguments: args,
      })) as { messages: { content: { text: string } }[] };
      return result.messages[0].content.text;
    },
    async call(
      name: string,
      args: Record<string, unknown> = {},
    ): Promise<ToolAnswer> {
      const result = (await request("tools/call", {
        name,
        arguments: args,
      })) as { content: { text: string }[]; isError?: boolean };
      return { text: result.content[0].text, isError: !!result.isError };
    },
  };
}

function agent(id: string, canWrite = true): AgentAccess {
  return {
    ownerId: OWNER,
    actor: { kind: "agent", id, name: `Agent ${id}` },
    canWrite,
  };
}

const parse = <T>(answer: ToolAnswer): T => {
  expect(answer.isError, answer.text).toBe(false);
  return JSON.parse(answer.text) as T;
};

const keys = (list: TaskList) => list.tasks.map((task) => task.key);

beforeEach(() => {
  now = new Date("2026-09-23T10:00:00Z");
  store = new InMemoryTaskStore();
});

describe("the tasks MCP server", () => {
  it("offers only the reading tools to a read-only token", async () => {
    const reader = await connect(agent("reader", false));

    expect(await reader.tools()).toEqual(["list_tasks", "get_task"]);
  });

  it("carries an agent through the loop: plan, claim, record, hand off", async () => {
    const planner = await connect(agent("planner"));

    const epic = parse<{ key: string }>(
      await planner.call("save_task", {
        title: "Ship agent access",
        add_criteria: ["Docs say how to connect"],
        attach: [
          {
            url: "https://github.com/Daniel88dev/fenro-dashboard/issues/7",
            is_source: true,
          },
        ],
      }),
    );
    await planner.call("save_task", {
      title: "Write the MCP route",
      parent: epic.key,
    });
    await planner.call("save_task", {
      title: "Write the docs",
      blocked_by: ["T-2"],
    });

    // The parent waits on its sub-task and T-3 on its blocker: only T-2 is
    // ready, so starting "whatever is next" lands there.
    const ready = parse<TaskList>(
      await planner.call("list_tasks", { ready: true }),
    );
    expect(keys(ready)).toEqual(["T-2"]);

    const worker = await connect(agent("worker"));
    const started = parse<TaskBrief>(await worker.call("start_task"));
    expect(started).toMatchObject({
      key: "T-2",
      state: "running",
      parent: { key: "T-1" },
    });

    const rival = await connect(agent("rival"));
    const refused = await rival.call("start_task", { task: "T-2" });
    expect(refused.isError).toBe(true);
    expect(refused.text).toMatch(/^task-claimed:/);

    await worker.call("add_note", {
      task: "T-2",
      kind: "decision",
      text: "Stateless Streamable HTTP, JSON answers.",
    });
    const finished = parse<{ status: string; session: unknown }>(
      await worker.call("finish_session", {
        task: "T-2",
        outcome: "done",
        summary: "Route is in; tokens are checked on every call.",
      }),
    );
    expect(finished.status).toBe("done");

    const next = parse<TaskList>(
      await planner.call("list_tasks", { ready: true }),
    );
    expect(keys(next)).toEqual(["T-1", "T-3"]);

    const brief = parse<TaskBrief>(
      await planner.call("get_task", { task: "T-2" }),
    );
    expect(brief.latestHandoff?.text).toBe(
      "Route is in; tokens are checked on every call.",
    );
    expect(brief.decisions.map((entry) => entry.text)).toEqual([
      "Stateless Streamable HTTP, JSON answers.",
    ]);
  });

  it("keeps a task open until its criteria are met", async () => {
    const planner = await connect(agent("planner"));
    await planner.call("save_task", {
      title: "Ship agent access",
      add_criteria: ["Docs say how to connect"],
    });

    const early = await planner.call("set_status", {
      task: "T-1",
      status: "done",
    });
    expect(early.text).toMatch(/^unmet-criteria:/);

    await planner.call("check_criterion", {
      task: "T-1",
      criterion: 1,
      evidence: "README, section Agents",
    });
    const done = parse<{ status: string; criteria: string[] }>(
      await planner.call("set_status", { task: "T-1", status: "done" }),
    );
    expect(done).toMatchObject({
      status: "done",
      criteria: ["[x] 1. Docs say how to connect"],
    });
  });

  it("refuses a link that would make a task wait on itself", async () => {
    const planner = await connect(agent("planner"));
    await planner.call("save_task", { title: "Parent" });
    await planner.call("save_task", { title: "Child", parent: "T-1" });

    // The parent cannot finish before its child, so a child blocked by its
    // parent would wait forever.
    const cycle = await planner.call("link_tasks", {
      task: "T-2",
      kind: "blocked_by",
      target: "T-1",
    });
    expect(cycle.text).toMatch(/^dependency-cycle:/);
  });

  it("lets another agent take over a claim that lapsed", async () => {
    const first = await connect(agent("first"));
    await first.call("save_task", { title: "Long job" });
    parse(await first.call("start_task", { task: "T-1" }));

    now = new Date("2026-09-23T12:30:00Z");
    const second = await connect(agent("second"));
    const taken = parse<TaskBrief>(
      await second.call("start_task", { task: "T-1" }),
    );
    expect(taken.session).toMatchObject({ number: 2, by: "Agent second" });
  });

  it("offers the work loop as a prompt to a token that can write", async () => {
    const worker = await connect(agent("worker"));

    expect(await worker.prompts()).toEqual(["work_on_next_task"]);
    expect(await worker.prompt("work_on_next_task")).toContain(
      "start_task without a task",
    );
    expect(
      await worker.prompt("work_on_next_task", {
        repository: "Daniel88dev/fenro-dashboard",
      }),
    ).toContain('repository: "Daniel88dev/fenro-dashboard"');
  });

  it("refuses to claim by key a task that is not ready", async () => {
    const planner = await connect(agent("planner"));
    await planner.call("save_task", { title: "Someday", status: "backlog" });
    await planner.call("save_task", { title: "Parent" });
    await planner.call("save_task", { title: "Child", parent: "T-2" });

    const backlog = await planner.call("start_task", { task: "T-1" });
    expect(backlog.text).toMatch(/^task-not-ready:/);
    const waiting = await planner.call("start_task", { task: "T-2" });
    expect(waiting.text).toMatch(/^open-subtasks:.*T-3/);
  });

  it("answers an unknown task with a refusal the agent can read", async () => {
    const reader = await connect(agent("reader", false));

    const missing = await reader.call("get_task", { task: "T-99" });
    expect(missing.isError).toBe(true);
    expect(missing.text).toMatch(/^task-not-found:/);
  });
});
