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
  CreateSkillHandler,
  type CreateSkillCommand,
} from "@/modules/tasks/application/commands/create-skill";
import {
  CreateTaskHandler,
  type CreateTaskCommand,
} from "@/modules/tasks/application/commands/create-task";
import {
  FinishSessionHandler,
  type FinishSessionCommand,
} from "@/modules/tasks/application/commands/finish-session";
import {
  LinkSkillHandler,
  type LinkSkillCommand,
} from "@/modules/tasks/application/commands/link-skill";
import {
  LinkTasksHandler,
  type LinkTasksCommand,
} from "@/modules/tasks/application/commands/link-tasks";
import {
  PostQuestionnaireHandler,
  type PostQuestionnaireCommand,
} from "@/modules/tasks/application/commands/post-questionnaire";
import {
  AnswerQuestionnaireHandler,
  WithdrawQuestionnaireHandler,
  type WithdrawQuestionnaireCommand,
} from "@/modules/tasks/application/commands/questionnaire-commands";
import {
  RecolourLabelHandler,
  type RecolourLabelCommand,
} from "@/modules/tasks/application/commands/recolour-label";
import {
  RecordNoteHandler,
  type RecordNoteCommand,
} from "@/modules/tasks/application/commands/record-note";
import {
  RenameLabelHandler,
  type RenameLabelCommand,
} from "@/modules/tasks/application/commands/rename-label";
import {
  RestoreSkillHandler,
  type RestoreSkillCommand,
} from "@/modules/tasks/application/commands/restore-skill";
import {
  ReviseSkillHandler,
  type ReviseSkillCommand,
} from "@/modules/tasks/application/commands/revise-skill";
import {
  StartTaskHandler,
  type StartTaskCommand,
} from "@/modules/tasks/application/commands/start-task";
import {
  UnlinkSkillHandler,
  type UnlinkSkillCommand,
} from "@/modules/tasks/application/commands/unlink-skill";
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
  QuestionnaireHandler,
  WaitForAnswersHandler,
  type QuestionnaireQuery,
  type QuestionnaireResult,
  type WaitForAnswersQuery,
  type WaitResult,
} from "@/modules/tasks/application/queries/questionnaire";
import {
  ListLabelsHandler,
  type ListLabelsQuery,
} from "@/modules/tasks/application/queries/list-labels";
import {
  ListSkillsHandler,
  type ListSkillsQuery,
} from "@/modules/tasks/application/queries/list-skills";
import {
  ListTasksHandler,
  type ListTasksQuery,
} from "@/modules/tasks/application/queries/list-tasks";
import type {
  LabelItem,
  SkillItem,
  TaskBrief,
  TaskList,
} from "@/modules/tasks/application/queries/read-models";
import {
  SkillHandler,
  type SkillQuery,
  type SkillResult,
} from "@/modules/tasks/application/queries/skill";
import {
  TaskBriefHandler,
  type TaskBriefQuery,
  type TaskBriefResult,
} from "@/modules/tasks/application/queries/task-brief";
import { HmacUploadTickets } from "@/modules/tasks/infrastructure/hmac-upload-tickets";
import { InMemoryPictureStorage } from "@/modules/tasks/infrastructure/in-memory-picture.storage";
import { InMemoryTaskStore } from "@/modules/tasks/infrastructure/in-memory-task.store";
import { InProcessAnswerNotifications } from "@/modules/tasks/infrastructure/in-process-answer-notifications";
import { CommandBus, QueryBus } from "@/shared/application";
import { unwrap } from "@/shared/domain";

import type { SpaceMembers } from "@/modules/tasks/application/ports/space-members";
import {
  SpaceMembersHandler,
  type SpaceMembersQuery,
} from "@/modules/tasks/application/queries/space-members";
import { personalSpace, type SpaceMember } from "@/modules/tasks/domain";

import { createTasksMcpServer, type AgentAccess } from "./tasks-mcp-server";

const OWNER = "user-1";

let now: Date;
let store: InMemoryTaskStore;
let storage: InMemoryPictureStorage;
let notifications: InProcessAnswerNotifications;
const tickets = new HmacUploadTickets("test-secret");

const members: SpaceMembers = {
  of: async (ownerId) =>
    ownerId === "group-hal"
      ? [
          { userId: OWNER, login: "Daniel88dev" },
          { userId: "user-2", login: "mira" },
        ]
      : [],
};

function buses() {
  const clock = () => now;
  const commandBus = new CommandBus();
  commandBus.register<CreateTaskCommand>(
    "tasks.create-task",
    new CreateTaskHandler(store, store, clock, members),
  );
  commandBus.register<UpdateTaskCommand>(
    "tasks.update-task",
    new UpdateTaskHandler(store, store, clock, members),
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
  commandBus.register<RecolourLabelCommand>(
    "tasks.recolour-label",
    new RecolourLabelHandler(store, clock),
  );
  commandBus.register<RenameLabelCommand>(
    "tasks.rename-label",
    new RenameLabelHandler(store, clock),
  );
  commandBus.register<CreateSkillCommand>(
    "tasks.create-skill",
    new CreateSkillHandler(store.skillRepository, store, clock),
  );
  commandBus.register<ReviseSkillCommand>(
    "tasks.revise-skill",
    new ReviseSkillHandler(store.skillRepository, clock),
  );
  commandBus.register<RestoreSkillCommand>(
    "tasks.restore-skill",
    new RestoreSkillHandler(store.skillRepository, clock),
  );
  commandBus.register<LinkSkillCommand>(
    "tasks.link-skill",
    new LinkSkillHandler(store.skillRepository, store, clock),
  );
  commandBus.register<UnlinkSkillCommand>(
    "tasks.unlink-skill",
    new UnlinkSkillHandler(store.skillRepository, clock),
  );
  const addPicture = new AddPictureHandler(store, store, storage, clock);
  commandBus.register<AddPictureCommand>("tasks.add-picture", addPicture);
  commandBus.register<UploadPictureCommand>(
    "tasks.upload-picture",
    new UploadPictureHandler(tickets, addPicture, clock),
  );
  commandBus.register<PostQuestionnaireCommand>(
    "tasks.post-questionnaire",
    new PostQuestionnaireHandler(
      store,
      store.questionnaireRepository,
      store,
      clock,
    ),
  );
  commandBus.register<WithdrawQuestionnaireCommand>(
    "tasks.withdraw-questionnaire",
    new WithdrawQuestionnaireHandler(
      store,
      store.questionnaireRepository,
      notifications,
      clock,
    ),
  );
  const queryBus = new QueryBus();
  queryBus.register<QuestionnaireQuery, QuestionnaireResult>(
    "tasks.questionnaire",
    new QuestionnaireHandler(store, clock),
  );
  queryBus.register<WaitForAnswersQuery, WaitResult>(
    "tasks.wait-for-answers",
    new WaitForAnswersHandler(store, notifications, clock),
  );
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
  queryBus.register<ListSkillsQuery, SkillItem[]>(
    "tasks.list-skills",
    new ListSkillsHandler(store, clock),
  );
  queryBus.register<SkillQuery, SkillResult>(
    "tasks.skill",
    new SkillHandler(store, clock),
  );
  queryBus.register<SpaceMembersQuery, readonly SpaceMember[]>(
    "tasks.space-members",
    new SpaceMembersHandler(members),
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
    task: (key) => `https://fenro.test/tasks/${key}`,
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

const HAL = {
  ownerId: "group-hal",
  prefix: "HAL",
  name: "Halcyon Labs",
  kind: "group",
} as const;

function agent(id: string, canWrite = true): AgentAccess {
  return {
    ownerId: OWNER,
    spaces: [personalSpace(OWNER), HAL],
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
  notifications = new InProcessAnswerNotifications();
});

describe("the tasks MCP server", () => {
  it("lets an agent label tasks, make labels, and filter by them", async () => {
    const agentSide = await connect(agent("labeller"));

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

  it("lets an agent ask questions, wait, and read the person's answers", async () => {
    const asker = await connect(agent("asker"));
    parse(await asker.call("save_task", { title: "Import Jira issues" }));
    parse(await asker.call("start_task", { task: "T-1" }));

    const posted = parse<{
      questionnaire: string;
      url: string;
      wait_until: string;
      questions: { id: string; type: string; options: string[] }[];
    }>(
      await asker.call("ask_questions", {
        task: "T-1",
        title: "Import scope",
        questions: [
          {
            id: "scope",
            prompt: "Which issues come in?",
            options: [
              { label: "Assigned to me", recommended: true },
              { label: "The whole project" },
              { label: "Other" },
            ],
          },
          { prompt: "Anything about your Jira setup?" },
        ],
      }),
    );
    expect(posted).toMatchObject({
      questionnaire: "T-1/1",
      url: "https://fenro.test/tasks/T-1?round=1",
      wait_until: "2026-09-23T10:15:00.000Z",
      questions: [
        { id: "scope", type: "single", options: ["a", "b"] },
        { id: "q2", type: "text", options: [] },
      ],
    });
    const twice = await asker.call("ask_questions", {
      task: "T-1",
      title: "Again",
      questions: [{ prompt: "Still there?" }],
    });
    expect(twice.text).toMatch(/^questionnaire-open:/);

    const open = parse<{ status: string; questions: number }>(
      await asker.call("get_answers", { questionnaire: "T-1/1" }),
    );
    expect(open).toMatchObject({ status: "open", questions: 2 });

    parse(
      await asker.call("finish_session", {
        task: "T-1",
        outcome: "paused",
        summary: "Asked about the import scope.",
      }),
    );
    expect(
      parse<TaskBrief>(await asker.call("get_task", { task: "T-1" })).state,
    ).toBe("blocked");

    const waiting = asker.call("wait_for_answers", {
      questionnaire: "T-1/1",
      seconds: 30,
    });
    now = new Date("2026-09-23T10:05:00Z");
    unwrap(
      await new AnswerQuestionnaireHandler(
        store,
        store.questionnaireRepository,
        store,
        notifications,
        () => now,
      ).handle({
        type: "tasks.answer-questionnaire",
        ownerId: OWNER,
        actor: { kind: "human", id: OWNER, name: "Daniel" },
        task: "T-1",
        round: 1,
        answers: [{ questionId: "scope", choices: ["a"], text: "Only FEN." }],
      }),
    );
    const answered = parse<{
      status: string;
      answered_by: string;
      answers: unknown[];
      then: string;
    }>(await waiting);
    expect(answered).toMatchObject({
      status: "answered",
      answered_by: "Daniel",
      answers: [
        {
          id: "scope",
          question: "Which issues come in?",
          chose: ["Assigned to me"],
          wrote: "Only FEN.",
          pictures: [],
        },
        {
          id: "q2",
          question: "Anything about your Jira setup?",
          chose: [],
          wrote: null,
          skipped: true,
        },
      ],
      then: "Carry on with the answers.",
    });

    const next = parse<{
      state: string;
      questionnaires: { questionnaire: string; status: string }[];
      new_answers: { questionnaire: string }[];
    }>(await asker.call("get_task", { task: "T-1" }));
    expect(next.state).toBe("paused");
    expect(next.questionnaires).toMatchObject([
      { questionnaire: "T-1/1", status: "answered", questions: 2, answered: 1 },
    ]);
    expect(next.new_answers.map((round) => round.questionnaire)).toEqual([
      "T-1/1",
    ]);
  });

  it("lets an agent withdraw a round it no longer needs", async () => {
    const asker = await connect(agent("asker"));
    parse(await asker.call("save_task", { title: "Import Jira issues" }));
    parse(
      await asker.call("ask_questions", {
        task: "T-1",
        title: "Sign-in",
        questions: [{ prompt: "Google or password?" }],
      }),
    );
    const withdrawn = parse<{ state: string }>(
      await asker.call("withdraw_questions", {
        task: "T-1",
        reason: "Found it in the Atlassian docs",
      }),
    );
    expect(withdrawn.state).toBe("ready");
    expect(
      parse<{ status: string; reason: string }>(
        await asker.call("get_answers", { task: "T-1" }),
      ),
    ).toMatchObject({
      status: "withdrawn",
      reason: "Found it in the Atlassian docs",
    });
  });

  it("offers only the reading tools to a read-only token", async () => {
    const reader = await connect(agent("reader", false));

    expect(await reader.tools()).toEqual([
      "list_tasks",
      "get_task",
      "list_labels",
      "list_skills",
      "get_skill",
      "get_picture",
      "get_answers",
      "wait_for_answers",
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

  it("opens a task from its pasted link and shows where it sits", async () => {
    const planner = await connect(agent("planner"));
    await planner.call("save_task", { title: "Agent access" });
    await planner.call("save_task", { title: "Token route", parent: "T-1" });

    const child = parse<TaskBrief & { url: string }>(
      await planner.call("get_task", {
        task: "https://fenro.test/tasks/T-2",
      }),
    );
    expect(child.url).toBe("https://fenro.test/tasks/T-2");
    expect(child.parent?.key).toBe("T-1");

    const children = parse<TaskList>(
      await planner.call("list_tasks", {
        parent: "https://fenro.test/tasks/T-1",
      }),
    );
    expect(keys(children)).toEqual(["T-2"]);
  });

  it("files and finds tasks in a group's space by its prefix", async () => {
    const planner = await connect(agent("planner"));
    await planner.call("save_task", { title: "Personal chore" });
    const shared = parse<{ key: string; url: string }>(
      await planner.call("save_task", { title: "Shared work", space: "hal" }),
    );
    await planner.call("save_task", { title: "Follow-up", parent: "HAL-1" });

    expect(shared).toMatchObject({
      key: "HAL-1",
      url: "https://fenro.test/tasks/HAL-1",
    });
    expect(keys(parse<TaskList>(await planner.call("list_tasks")))).toEqual(
      expect.arrayContaining(["T-1", "HAL-1", "HAL-2"]),
    );
    expect(
      keys(parse<TaskList>(await planner.call("list_tasks", { space: "HAL" }))),
    ).toEqual(expect.arrayContaining(["HAL-1", "HAL-2"]));
    expect(
      parse<TaskBrief>(await planner.call("get_task", { task: "HAL-2" })).parent
        ?.key,
    ).toBe("HAL-1");
    expect((await planner.call("get_task", { task: "HAL-3" })).isError).toBe(
      true,
    );
    expect((await planner.call("list_tasks", { space: "NOPE" })).isError).toBe(
      true,
    );
  });

  it("assigns group tasks and lists them by assignee", async () => {
    const planner = await connect(agent("planner"));
    await planner.call("save_task", { title: "Personal chore" });
    await planner.call("save_task", {
      title: "Mine in the group",
      space: "HAL",
      assignee: "me",
    });
    await planner.call("save_task", { title: "Open", space: "HAL" });
    const reassigned = parse<{ assignee: string | null }>(
      await planner.call("save_task", { task: "HAL-2", assignee: "mira" }),
    );

    const assigneeOf = async (filter: Record<string, unknown>) =>
      Object.fromEntries(
        parse<{ tasks: { key: string; assignee: string | null }[] }>(
          await planner.call("list_tasks", filter),
        ).tasks.map((task) => [task.key, task.assignee]),
      );

    expect(reassigned.assignee).toBe("mira");
    expect(await assigneeOf({})).toEqual({
      "T-1": "me",
      "HAL-1": "me",
      "HAL-2": "mira",
    });
    expect(await assigneeOf({ assignee: "me" })).toEqual({
      "T-1": "me",
      "HAL-1": "me",
    });
    expect(await assigneeOf({ assignee: "@Mira" })).toEqual({
      "HAL-2": "mira",
    });
    expect(
      (await planner.call("list_tasks", { assignee: "stranger" })).isError,
    ).toBe(true);
    expect(
      (await planner.call("save_task", { task: "T-1", assignee: "mira" }))
        .isError,
    ).toBe(true);

    await planner.call("save_task", { task: "HAL-2", assignee: null });
    expect(await assigneeOf({ assignee: "unassigned" })).toEqual({
      "HAL-2": null,
    });
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

  it("hands a task's skills in full on start_task and by name on get_task", async () => {
    const lead = await connect(agent("lead"));
    parse(
      await lead.call("save_skill", {
        name: "frontend-conventions",
        description: "Use when building or changing UI.",
        instructions: "## Tokens\n\nUse colour tokens, never `dark:` classes.",
        labels: ["frontend", "ui"],
      }),
    );
    parse(
      await lead.call("save_skill", {
        name: "migrations",
        description: "Use when changing the schema.",
        instructions: "Run `pnpm db:generate`.",
        labels: ["database"],
      }),
    );
    parse(await lead.call("save_task", { title: "Top bar", labels: ["ui"] }));

    const looked = parse<TaskBrief>(
      await lead.call("get_task", { task: "T-1" }),
    );
    expect(looked.skills).toEqual([
      {
        name: "frontend-conventions",
        description: "Use when building or changing UI.",
        via: ["ui"],
        revision: 1,
      },
    ]);

    const started = parse<TaskBrief>(
      await lead.call("start_task", { task: "T-1" }),
    );
    expect(started.skills).toEqual([
      expect.objectContaining({
        name: "frontend-conventions",
        instructions: expect.stringContaining("never `dark:` classes"),
      }),
    ]);
  });

  it("brings the person's own skills to a group task they work", async () => {
    const member = await connect(agent("member"));
    parse(
      await member.call("save_skill", {
        name: "frontend-conventions",
        description: "Use when building or changing UI.",
        instructions: "Use colour tokens.",
        labels: ["ui"],
      }),
    );
    parse(
      await member.call("save_task", {
        title: "Shared top bar",
        labels: ["ui"],
        space: "HAL",
      }),
    );

    const looked = parse<TaskBrief>(
      await member.call("get_task", { task: "HAL-1" }),
    );
    expect(looked.skills.map((skill) => skill.name)).toEqual([
      "frontend-conventions",
    ]);

    const started = parse<TaskBrief>(
      await member.call("start_task", { task: "HAL-1" }),
    );
    expect(started.skills).toEqual([
      expect.objectContaining({
        name: "frontend-conventions",
        instructions: "Use colour tokens.",
      }),
    ]);
  });

  it("lets an agent find, read, change and restore a skill", async () => {
    const author = await connect(agent("author"));
    parse(
      await author.call("save_skill", {
        name: "Reviews",
        description: "Use when reviewing a pull request.",
        instructions: "Read the diff twice.",
      }),
    );
    const missing = await author.call("save_skill", { name: "half-done" });
    expect(missing.isError).toBe(true);

    const blind = await author.call("save_skill", {
      skill: "reviews",
      instructions: "Read the diff once.",
    });
    expect(blind.text).toMatch(/^stale-skill:/);
    const revised = parse<{ revision: number; labels: string[] }>(
      await author.call("save_skill", {
        skill: "reviews",
        revision: 1,
        name: "code-reviews",
        instructions: "Read the diff, then run it.",
        add_labels: ["Review"],
      }),
    );
    expect(revised).toMatchObject({ revision: 2, labels: ["review"] });
    const stale = await author.call("save_skill", {
      skill: "code-reviews",
      revision: 1,
      description: "Older view.",
    });
    expect(stale.text).toMatch(/^stale-skill:/);

    const reader = await connect(agent("reader", false));
    expect(
      parse<{ name: string }[]>(
        await reader.call("list_skills", { label: "review" }),
      ).map((skill) => skill.name),
    ).toEqual(["code-reviews"]);
    expect(
      parse<unknown[]>(await reader.call("list_skills", { text: "deploy" })),
    ).toEqual([]);
    const read = parse<{
      instructions: string;
      revisions: { revision: number; by: string }[];
      requested_revision: { instructions: string };
    }>(await reader.call("get_skill", { skill: "code-reviews", revision: 1 }));
    expect(read.instructions).toBe("Read the diff, then run it.");
    expect(read.revisions.map((revision) => revision.revision)).toEqual([2, 1]);
    expect(read.requested_revision.instructions).toBe("Read the diff twice.");

    const restored = parse<{ name: string; revision: number }>(
      await author.call("save_skill", {
        skill: "code-reviews",
        revision: 2,
        restore: 1,
      }),
    );
    expect(restored).toMatchObject({ name: "reviews", revision: 3 });

    const relabelled = parse<{ labels: string[] }>(
      await author.call("save_skill", {
        skill: "reviews",
        labels: ["pr", "docs"],
      }),
    );
    expect(relabelled.labels).toEqual(["docs", "pr"]);
    const labels = parse<{ name: string; skills: string[] }[]>(
      await author.call("list_labels"),
    );
    expect(labels.find((label) => label.name === "pr")?.skills).toEqual([
      "reviews",
    ]);

    const unknown = await reader.call("get_skill", { skill: "nope" });
    expect(unknown.text).toMatch(/^skill-not-found:/);
  });

  it("lets an agent create, recolour and rename a label", async () => {
    const agentSide = await connect(agent("labeller"));
    parse(await agentSide.call("save_task", { title: "Fix", labels: ["bug"] }));
    parse(
      await agentSide.call("save_skill", {
        name: "bug-fixing",
        description: "Use when fixing a bug.",
        instructions: "Write the failing test first.",
        labels: ["bug"],
      }),
    );

    expect(
      parse(
        await agentSide.call("save_label", { name: "Docs", colour: "teal" }),
      ),
    ).toMatchObject({ name: "docs", colour: "teal" });

    const renamed = parse<{ name: string; colour: string; skills: string[] }>(
      await agentSide.call("save_label", {
        name: "bug",
        new_name: "defect",
        colour: "red",
      }),
    );
    expect(renamed).toMatchObject({
      name: "defect",
      colour: "red",
      skills: ["bug-fixing"],
    });
    const task = parse<TaskBrief>(
      await agentSide.call("get_task", { task: "T-1" }),
    );
    expect(task.labels).toEqual(["defect"]);
    expect(task.skills.map((skill) => skill.name)).toEqual(["bug-fixing"]);

    const nothing = await agentSide.call("save_label", {
      name: "ghost",
      new_name: "spirit",
    });
    expect(nothing.text).toMatch(/^label-not-found:/);
    const clash = await agentSide.call("save_label", {
      name: "docs",
      new_name: "defect",
    });
    expect(clash.text).toMatch(/^label-exists:/);
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

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13,
]);
