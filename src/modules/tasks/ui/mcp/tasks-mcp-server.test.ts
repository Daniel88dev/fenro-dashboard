import {
  InMemoryTransport,
  LATEST_PROTOCOL_VERSION,
  type JSONRPCMessage,
} from "@modelcontextprotocol/server";
import { beforeEach, describe, expect, it } from "vitest";

import {
  AddPictureHandler,
  UploadPictureHandler,
  type AddPictureCommand,
  type UploadPictureCommand,
} from "@/modules/tasks/application/commands/add-picture";
import {
  ChangeStatusHandler,
  type ChangeStatusCommand,
} from "@/modules/tasks/application/commands/change-status";
import {
  CheckCriterionHandler,
  type CheckCriterionCommand,
} from "@/modules/tasks/application/commands/check-criterion";
import {
  CreateLabelHandler,
  type CreateLabelCommand,
} from "@/modules/tasks/application/commands/create-label";
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
  PictureContentHandler,
  type PictureContentQuery,
  type PictureContentResult,
} from "@/modules/tasks/application/queries/picture";
import {
  PictureUploadTicketHandler,
  type PictureUploadTicketQuery,
  type PictureUploadTicketResult,
} from "@/modules/tasks/application/queries/picture-upload-ticket";
import {
  ListLabelsHandler,
  type ListLabelsQuery,
} from "@/modules/tasks/application/queries/list-labels";
import {
  ListTasksHandler,
  type ListTasksQuery,
} from "@/modules/tasks/application/queries/list-tasks";
import type {
  LabelItem,
  TaskBrief,
  TaskList,
} from "@/modules/tasks/application/queries/read-models";
import {
  TaskBriefHandler,
  type TaskBriefQuery,
  type TaskBriefResult,
} from "@/modules/tasks/application/queries/task-brief";
import { HmacUploadTickets } from "@/modules/tasks/infrastructure/hmac-upload-tickets";
import { InMemoryPictureStorage } from "@/modules/tasks/infrastructure/in-memory-picture.storage";
import { InMemoryTaskStore } from "@/modules/tasks/infrastructure/in-memory-task.store";
import { CommandBus, QueryBus } from "@/shared/application";

import { createTasksMcpServer, type AgentAccess } from "./tasks-mcp-server";

const OWNER = "user-1";

let now: Date;
let store: InMemoryTaskStore;
let storage: InMemoryPictureStorage;
const tickets = new HmacUploadTickets("test-secret");

function buses() {
  const clock = () => now;
  const commandBus = new CommandBus();
  commandBus.register<CreateTaskCommand>(
    "tasks.create-task",
    new CreateTaskHandler(store, store, clock),
  );
  commandBus.register<UpdateTaskCommand>(
    "tasks.update-task",
    new UpdateTaskHandler(store, store, clock),
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
  commandBus.register<CreateLabelCommand>(
    "tasks.create-label",
    new CreateLabelHandler(store, clock),
  );
  const addPicture = new AddPictureHandler(store, store, storage, clock);
  commandBus.register<AddPictureCommand>("tasks.add-picture", addPicture);
  commandBus.register<UploadPictureCommand>(
    "tasks.upload-picture",
    new UploadPictureHandler(tickets, addPicture, clock),
  );
  const queryBus = new QueryBus();
  queryBus.register<PictureContentQuery, PictureContentResult>(
    "tasks.picture-content",
    new PictureContentHandler(store, storage),
  );
  queryBus.register<PictureUploadTicketQuery, PictureUploadTicketResult>(
    "tasks.picture-upload-ticket",
    new PictureUploadTicketHandler(store, storage, tickets, clock),
  );
  queryBus.register<ListLabelsQuery, LabelItem[]>(
    "tasks.list-labels",
    new ListLabelsHandler(store),
  );
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
type Content = {
  type: string;
  text?: string;
  data?: string;
  mimeType?: string;
};

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
  await createTasksMcpServer(access, buses(), {
    upload: (ticket) => `https://fenro.test/api/pictures/upload/${ticket}`,
  }).connect(serverSide);
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
    async look(
      name: string,
      args: Record<string, unknown> = {},
    ): Promise<Content[]> {
      const result = (await request("tools/call", {
        name,
        arguments: args,
      })) as { content: Content[] };
      return result.content;
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
  storage = new InMemoryPictureStorage();
});

describe("the tasks MCP server", () => {
  it("lets an agent label tasks, make labels, and filter by them", async () => {
    const agentSide = await connect(agent("labeller"));

    // A name nobody made yet is made on the spot, in one call.
    parse(
      await agentSide.call("save_task", {
        title: "Fix sign-in",
        labels: ["Bug", "area:auth"],
      }),
    );
    const made = parse<{ name: string; colour: string }>(
      await agentSide.call("create_label", {
        name: "Needs review",
        colour: "purple",
      }),
    );
    expect(made).toMatchObject({ name: "needs-review", colour: "purple" });
    const twice = await agentSide.call("create_label", { name: "bug" });
    expect(twice.isError).toBe(true);
    expect(twice.text).toMatch(/^label-exists:/);

    await agentSide.call("save_task", { title: "Write docs" });
    const updated = parse<{ labels: string[] }>(
      await agentSide.call("save_task", {
        task: "T-1",
        add_labels: ["needs-review"],
        remove_labels: ["Bug"],
      }),
    );
    expect(updated.labels).toEqual(["area:auth", "needs-review"]);

    const labels = parse<{ name: string; open_tasks: number }[]>(
      await agentSide.call("list_labels"),
    );
    expect(labels.map((label) => [label.name, label.open_tasks])).toEqual([
      ["area:auth", 1],
      ["bug", 0],
      ["needs-review", 1],
    ]);

    const filtered = parse<TaskList>(
      await agentSide.call("list_tasks", { labels: ["needs-review", "bug"] }),
    );
    expect(keys(filtered)).toEqual(["T-1"]);
  });

  it("offers only the reading tools to a read-only token", async () => {
    const reader = await connect(agent("reader", false));

    expect(await reader.tools()).toEqual([
      "list_tasks",
      "get_task",
      "list_labels",
      "get_picture",
    ]);
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

  it("lets an agent attach a picture inline and look at it later", async () => {
    const designer = await connect(agent("designer"));
    parse(await designer.call("save_task", { title: "Redesign sign-in" }));

    const attached = parse<{ id: string; name: string; addedBy: string }>(
      await designer.call("attach_picture", {
        task: "T-1",
        file_name: "prototypes/sign-in-a",
        data_base64: Buffer.from(PNG).toString("base64"),
      }),
    );
    expect(attached).toMatchObject({
      name: "sign-in-a.png",
      addedBy: "Agent designer",
    });

    const task = parse<TaskBrief>(
      await designer.call("get_task", { task: "T-1" }),
    );
    expect(task.pictures.map((picture) => picture.id)).toEqual([attached.id]);

    const seen = await designer.look("get_picture", { picture: attached.id });
    expect(seen).toEqual([
      { type: "text", text: "sign-in-a.png" },
      {
        type: "image",
        data: Buffer.from(PNG).toString("base64"),
        mimeType: "image/png",
      },
    ]);
  });

  it("hands out an upload link that adds the picture when the bytes arrive", async () => {
    const designer = await connect(agent("designer"));
    parse(await designer.call("save_task", { title: "Redesign sign-in" }));

    const offer = parse<{ picture: string; upload_url: string; run: string }>(
      await designer.call("attach_picture", {
        task: "T-1",
        file_name: "direction-b.png",
      }),
    );
    expect(offer.run).toContain("curl -fsS -T");
    expect(offer.run).toContain(offer.upload_url);
    // Asking for a link adds nothing yet.
    expect(storage.files.size).toBe(0);

    const ticket = offer.upload_url.split("/").pop()!;
    const upload = new UploadPictureHandler(
      tickets,
      new AddPictureHandler(store, store, storage, () => now),
      () => now,
    );
    const sent = await upload.handle({
      type: "tasks.upload-picture",
      ticket,
      bytes: PNG,
    });
    expect(sent.ok).toBe(true);

    const task = parse<TaskBrief>(
      await designer.call("get_task", { task: "T-1" }),
    );
    expect(task.pictures).toMatchObject([
      { id: offer.picture, name: "direction-b.png", addedBy: "Agent designer" },
    ]);
  });

  it("refuses a file that is not a picture", async () => {
    const designer = await connect(agent("designer"));
    parse(await designer.call("save_task", { title: "Redesign sign-in" }));

    const refused = await designer.call("attach_picture", {
      task: "T-1",
      file_name: "evil.svg",
      data_base64: Buffer.from("<svg onload=alert(1)>").toString("base64"),
    });
    expect(refused.isError).toBe(true);
    expect(refused.text).toMatch(/^invalid-picture:/);
    expect(storage.files.size).toBe(0);
  });
});

/** The smallest bytes that read as a PNG: its signature and a little more. */
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13,
]);
