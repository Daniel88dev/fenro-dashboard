import { McpServer, type CallToolResult } from "@modelcontextprotocol/server";
import { z } from "zod";

import type { AddPictureCommand } from "@/modules/tasks/application/commands/add-picture";
import type { ChangeStatusCommand } from "@/modules/tasks/application/commands/change-status";
import type { CreateLabelCommand } from "@/modules/tasks/application/commands/create-label";
import type { CheckCriterionCommand } from "@/modules/tasks/application/commands/check-criterion";
import type { CreateTaskCommand } from "@/modules/tasks/application/commands/create-task";
import type { FinishSessionCommand } from "@/modules/tasks/application/commands/finish-session";
import type { LinkTasksCommand } from "@/modules/tasks/application/commands/link-tasks";
import type { RecordNoteCommand } from "@/modules/tasks/application/commands/record-note";
import type { StartTaskCommand } from "@/modules/tasks/application/commands/start-task";
import type { UpdateTaskCommand } from "@/modules/tasks/application/commands/update-task";
import { listLabelsQuery } from "@/modules/tasks/application/queries/list-labels";
import { listTasksQuery } from "@/modules/tasks/application/queries/list-tasks";
import { pictureContentQuery } from "@/modules/tasks/application/queries/picture";
import type { PictureUploadTicketQuery } from "@/modules/tasks/application/queries/picture-upload-ticket";
import type {
  LabelItem,
  TaskBrief,
} from "@/modules/tasks/application/queries/read-models";
import { taskBriefQuery } from "@/modules/tasks/application/queries/task-brief";
import {
  LABEL_COLOURS,
  normaliseLabelName,
  NOTE_KINDS,
  PRIORITIES,
  SESSION_OUTCOMES,
  TASK_STATUSES,
  type Actor,
  type LinkKind,
  type TaskError,
} from "@/modules/tasks/domain";
import type { CommandBus, QueryBus } from "@/shared/application";
import type { Result } from "@/shared/domain";

/** Who is calling and what they may do, from the token they presented. */
export type AgentAccess = {
  readonly ownerId: string;
  readonly actor: Extract<Actor, { kind: "agent" }>;
  readonly canWrite: boolean;
};

/**
 * What the task page renders, told to the agent once in the instructions and
 * again, briefly, on each field that takes it. People read these fields on
 * the task page, so structure pays; raw HTML is dropped, not rendered.
 */
export const FORMATTING = `Formatting: descriptions, notes, handoff summaries, criteria and evidence are GitHub-flavoured Markdown, shown rendered to the person on the task page. Use short paragraphs, "## " headings to split a long description (Context, What to build, Out of scope), "- " lists (indent two spaces to nest), \`code\` for paths, identifiers and commands, fenced code blocks with a language, tables for comparisons, "> " for quotes, and "- [ ] " for a checklist. A single newline is a line break. HTML is not rendered. Put each acceptance criterion in add_criteria, not as a checklist in the description, so it can be checked off.`;

const MARKDOWN = "GitHub-flavoured Markdown, rendered for people";

/**
 * Pictures carry what text cannot: a design from a prototype, a screenshot of
 * a bug. They are shown to the person on the task page, and the next session
 * can look at them.
 */
export const PICTURES = `Pictures: a task can carry PNG, JPEG, WebP or GIF pictures up to 4 MB, such as a design from a prototype or a screenshot of a bug. attach_picture adds one: it returns an upload link, and you send the file with the curl command it gives. get_task lists a task's pictures, and get_picture shows you one.`;

export const INSTRUCTIONS = `Fenro is the task list you work from. Tasks carry context between sessions, so record what you learn as you go.

The loop:
1. list_tasks with ready: true, or start_task without a task to take the top ready one.
2. start_task claims the task and returns its brief. Read the latest handoff and the decisions first. The claim lapses after 2 hours without a call, so another agent can take over if you stop.
3. While working, add_note for decisions, discoveries and open questions. File new work you find with save_task and discovered_from, rather than doing it now.
4. check_criterion for each acceptance criterion with its evidence.
5. finish_session with a handoff summary and an outcome: done, in_review (a person must look, e.g. a pull request is open), paused, blocked (say on what), or released (give it back).

A task is not done while it has open sub-tasks or unmet criteria. Tasks are named by key, like T-12.

Labels group tasks, and the person filters their list by them. Reuse the labels list_labels returns before inventing new ones; a name that does not exist yet is created when a task is saved with it.

${FORMATTING}

${PICTURES}`;

/**
 * The tasks context as an MCP server: the way an agent reads and changes the
 * task list. Built per request for one agent; every tool is a thin mapping
 * onto a command or a query on the buses, and a refusal from the domain comes
 * back as a tool error the agent can read and act on.
 *
 * Output is compact JSON; only `get_task` and `start_task` return a full
 * brief, because tool results are paid for in the agent's context window.
 */
export function createTasksMcpServer(
  access: AgentAccess,
  buses: { readonly commandBus: CommandBus; readonly queryBus: QueryBus },
  links: {
    /** The address a picture's bytes go to, for a ticket. */
    readonly upload: (ticket: string) => string;
  },
): McpServer {
  const { ownerId, actor } = access;
  const { commandBus, queryBus } = buses;
  const server = new McpServer(
    { name: "fenro-tasks", version: "1.0.0" },
    { instructions: INSTRUCTIONS },
  );

  const brief = async (task: string, journalLimit?: number) =>
    queryBus.ask(taskBriefQuery(ownerId, task, journalLimit));

  /** After a change, answer with where the task now stands. */
  const standing = async (
    task: string,
    outcome: Result<void, TaskError>,
  ): Promise<CallToolResult> => {
    if (!outcome.ok) return refused(outcome.error);
    const found = await brief(task, 0);
    return found.ok ? json(standingOf(found.value)) : refused(found.error);
  };

  server.registerTool(
    "list_tasks",
    {
      title: "List tasks",
      description:
        "List tasks, open ones only unless a status is given. ready: true gives the queue to pick work from, best first. Compact: use get_task for detail.",
      inputSchema: z.object({
        ready: z.boolean().optional(),
        status: z.array(z.enum(TASK_STATUSES)).optional(),
        include_closed: z.boolean().optional(),
        repository: z.string().optional().describe("owner/name"),
        labels: z
          .array(z.string())
          .optional()
          .describe("Tasks carrying any of these labels"),
        parent: z.string().optional().describe("Only sub-tasks of this task"),
        text: z.string().optional().describe("Words in the title"),
        limit: z.number().int().min(1).max(100).optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (input) =>
      json(
        await queryBus.ask(
          listTasksQuery(ownerId, {
            ready: input.ready,
            statuses: input.status,
            includeClosed: input.include_closed,
            repository: input.repository,
            labels: input.labels,
            parent: input.parent,
            text: input.text,
            limit: input.limit,
          }),
        ),
      ),
  );

  server.registerTool(
    "get_task",
    {
      title: "Read a task",
      description:
        "The full brief for one task: description, acceptance criteria, blockers, sub-tasks, links, the latest handoff, every decision, the recent journal and the task's pictures.",
      inputSchema: z.object({
        task: z.string().describe("Key, e.g. T-12"),
        journal_limit: z.number().int().min(0).max(200).optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ task, journal_limit }) => {
      const found = await brief(task, journal_limit);
      return found.ok ? json(found.value) : refused(found.error);
    },
  );

  server.registerTool(
    "list_labels",
    {
      title: "List labels",
      description:
        "The labels tasks can carry, with each one's colour and how many open tasks carry it. Reuse these names in save_task and list_tasks.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () =>
      json((await queryBus.ask(listLabelsQuery(ownerId))).map(labelOf)),
  );

  server.registerTool(
    "get_picture",
    {
      title: "Look at a picture",
      description:
        "Shows you one of a task's pictures (get_task lists them with their ids): a design to build from, a screenshot to compare with.",
      inputSchema: z.object({
        picture: z.string().describe("The picture's id from get_task"),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ picture }) => {
      const found = await queryBus.ask(pictureContentQuery(ownerId, picture));
      if (!found.ok) return refused(found.error);
      return {
        content: [
          { type: "text", text: found.value.name },
          {
            type: "image",
            data: Buffer.from(found.value.bytes).toString("base64"),
            mimeType: found.value.type,
          },
        ],
      };
    },
  );

  if (!access.canWrite) return server;

  // The loop is in the instructions too; as a prompt it becomes a slash command
  // that starts a session, e.g. /mcp__fenro__work_on_next_task in Claude Code.
  server.registerPrompt(
    "work_on_next_task",
    {
      title: "Work on the next task",
      description:
        "Claim the top ready task, work it, and hand off. Give a repository to pick only from its tasks.",
      argsSchema: z.object({
        repository: z
          .string()
          .optional()
          .describe("owner/name to pick only from that repository's tasks"),
      }),
    },
    ({ repository }) => ({
      messages: [
        {
          role: "user",
          content: { type: "text", text: workOnNextTask(repository?.trim()) },
        },
      ],
    }),
  );

  server.registerTool(
    "save_task",
    {
      title: "Create or update a task",
      description:
        "Without task, creates one (title required). With task, changes only the fields given. Use discovered_from when filing work found while on another task. attach takes links to the task's source or related pages (GitHub issue or PR, Jira, Linear, any URL).",
      inputSchema: z.object({
        task: z.string().optional().describe("Key of the task to update"),
        title: z.string().optional(),
        description: z.string().optional().describe(MARKDOWN),
        priority: z.enum(PRIORITIES).optional(),
        labels: z
          .array(z.string())
          .optional()
          .describe(
            "Replaces all labels. Names not in list_labels yet are created, in a colour of their own",
          ),
        add_labels: z
          .array(z.string())
          .optional()
          .describe(
            "On update: labels to add, keeping the rest; new names are created",
          ),
        remove_labels: z
          .array(z.string())
          .optional()
          .describe("On update: labels to take off"),
        repository: z
          .string()
          .nullable()
          .optional()
          .describe("owner/name; null clears"),
        parent: z
          .string()
          .nullable()
          .optional()
          .describe("Makes it a sub-task; null makes it top-level"),
        status: z
          .enum(["backlog", "todo"])
          .optional()
          .describe("On create only; default todo"),
        add_criteria: z
          .array(z.string())
          .optional()
          .describe("One line each; inline Markdown (code, bold, links)"),
        remove_criteria: z.array(z.number().int()).optional(),
        attach: z
          .array(
            z.object({
              url: z.string(),
              title: z.string().optional(),
              is_source: z.boolean().optional(),
            }),
          )
          .optional(),
        detach: z.array(z.string()).optional().describe("URLs to remove"),
        blocked_by: z.array(z.string()).optional().describe("On create only"),
        relates_to: z.array(z.string()).optional().describe("On create only"),
        discovered_from: z.string().optional().describe("On create only"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (input) => {
      const attach = input.attach?.map((reference) => ({
        url: reference.url,
        title: reference.title,
        isSource: reference.is_source,
      }));

      if (input.task) {
        const task = input.task;
        const command: UpdateTaskCommand = {
          type: "tasks.update-task",
          ownerId,
          actor,
          task,
          title: input.title,
          description: input.description,
          priority: input.priority,
          labels: input.labels,
          addLabels: input.add_labels,
          removeLabels: input.remove_labels,
          repository: input.repository,
          parent: input.parent,
          addCriteria: input.add_criteria,
          removeCriteria: input.remove_criteria,
          attach,
          detach: input.detach,
        };
        return standing(task, await commandBus.dispatch(command));
      }

      if (!input.title) {
        return text(
          "Give a title to create a task, or a task key to update one.",
          true,
        );
      }
      const taskId = crypto.randomUUID();
      const command: CreateTaskCommand = {
        type: "tasks.create-task",
        ownerId,
        actor,
        taskId,
        title: input.title,
        description: input.description,
        status: input.status,
        priority: input.priority,
        labels: [...(input.labels ?? []), ...(input.add_labels ?? [])],
        repository: input.repository,
        parent: input.parent,
        criteria: input.add_criteria,
        references: attach,
        blockedBy: input.blocked_by,
        relatesTo: input.relates_to,
        discoveredFrom: input.discovered_from,
      };
      return standing(taskId, await commandBus.dispatch(command));
    },
  );

  server.registerTool(
    "create_label",
    {
      title: "Create a label",
      description:
        "Add a label before any task carries it, or in a colour you choose. Not needed just to label a task: save_task creates unknown names itself. Names are lower-case; spaces become -.",
      inputSchema: z.object({
        name: z.string().describe("e.g. bug, needs-review, area:auth"),
        colour: z
          .enum(LABEL_COLOURS)
          .optional()
          .describe("Left out, the name picks one"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (input) => {
      const command: CreateLabelCommand = {
        type: "tasks.create-label",
        ownerId,
        actor,
        labelId: crypto.randomUUID(),
        name: input.name,
        colour: input.colour,
      };
      const created = await commandBus.dispatch(command);
      if (!created.ok) return refused(created.error);
      const labels = await queryBus.ask(listLabelsQuery(ownerId));
      const name = normaliseLabelName(input.name);
      const label = labels.find((candidate) => candidate.name === name);
      return json(label ? labelOf(label) : { name });
    },
  );

  server.registerTool(
    "start_task",
    {
      title: "Start working on a task",
      description:
        "Claims a task for you and returns its brief. Without task, takes the top ready one. Starting a task you already hold resumes your session.",
      inputSchema: z.object({ task: z.string().optional() }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ task }) => {
      const candidates = task
        ? [task]
        : (
            await queryBus.ask(
              listTasksQuery(ownerId, { ready: true, limit: 5 }),
            )
          ).tasks.map((item) => item.key);
      if (candidates.length === 0) {
        return text("No task is ready. List tasks to see what is blocked.");
      }

      let last: TaskError | undefined;
      for (const candidate of candidates) {
        const command: StartTaskCommand = {
          type: "tasks.start-task",
          ownerId,
          actor,
          task: candidate,
        };
        const started = await commandBus.dispatch(command);
        if (started.ok) {
          const found = await brief(candidate);
          return found.ok ? json(found.value) : refused(found.error);
        }
        last = started.error;
        // Another agent took it between the list and the claim: try the next.
        if (task || started.error.code !== "task-claimed") break;
      }
      return refused(last!);
    },
  );

  server.registerTool(
    "add_note",
    {
      title: "Record in the task's journal",
      description:
        "Append a note, decision, discovery or question. Entries are permanent and are what the next session reads; a correction is a new entry.",
      inputSchema: z.object({
        task: z.string(),
        kind: z.enum(NOTE_KINDS as [string, ...string[]]),
        text: z.string().describe(MARKDOWN),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (input) => {
      const command: RecordNoteCommand = {
        type: "tasks.record-note",
        ownerId,
        actor,
        task: input.task,
        kind: input.kind as RecordNoteCommand["kind"],
        text: input.text,
      };
      return standing(input.task, await commandBus.dispatch(command));
    },
  );

  server.registerTool(
    "attach_picture",
    {
      title: "Add a picture to a task",
      description:
        "Add a PNG, JPEG, WebP or GIF picture (up to 4 MB) to a task, such as a design from a prototype or a screenshot. Returns an upload link and a curl command: run it with the file's path. Without a shell, give data_base64 instead (up to 3 MB).",
      inputSchema: z.object({
        task: z.string(),
        file_name: z.string().describe("e.g. sign-in-direction-a.png"),
        data_base64: z
          .string()
          .optional()
          .describe("The picture itself, only when you cannot run curl"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (input) => {
      const pictureId = crypto.randomUUID();
      if (input.data_base64 === undefined) {
        const query: PictureUploadTicketQuery = {
          type: "tasks.picture-upload-ticket",
          ownerId,
          actor,
          task: input.task,
          pictureId,
          name: input.file_name,
        };
        const ticket = await queryBus.ask(query);
        if (!ticket.ok) return refused(ticket.error);
        const url = links.upload(ticket.value.token);
        return json({
          picture: pictureId,
          upload_url: url,
          expires_at: ticket.value.expiresAt,
          run: `curl -fsS -T '<path to ${input.file_name}>' '${url}'`,
          then: "The picture is on the task once curl succeeds.",
        });
      }

      if (input.data_base64.length > INLINE_LIMIT_BASE64) {
        return text(
          "invalid-picture: data_base64 takes pictures up to 3 MB. Leave it out to get an upload link, which takes up to 4 MB.",
          true,
        );
      }
      const command: AddPictureCommand = {
        type: "tasks.add-picture",
        ownerId,
        actor,
        pictureId,
        task: input.task,
        fileName: input.file_name,
        bytes: new Uint8Array(Buffer.from(input.data_base64, "base64")),
      };
      const added = await commandBus.dispatch(command);
      if (!added.ok) return refused(added.error);
      const found = await brief(input.task, 0);
      const item = found.ok
        ? found.value.pictures.find((picture) => picture.id === pictureId)
        : undefined;
      return json(item ?? { picture: pictureId });
    },
  );

  server.registerTool(
    "check_criterion",
    {
      title: "Mark an acceptance criterion",
      description:
        "Mark criterion met with the evidence that shows it (a test run, a commit, a link), or met: false to undo.",
      inputSchema: z.object({
        task: z.string(),
        criterion: z.number().int(),
        met: z.boolean().default(true),
        evidence: z
          .string()
          .optional()
          .describe("Inline Markdown; link the run, commit or PR"),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async (input) => {
      const command: CheckCriterionCommand = {
        type: "tasks.check-criterion",
        ownerId,
        actor,
        task: input.task,
        criterion: input.criterion,
        met: input.met,
        evidence: input.evidence,
      };
      return standing(input.task, await commandBus.dispatch(command));
    },
  );

  server.registerTool(
    "link_tasks",
    {
      title: "Link two tasks",
      description:
        "task is blocked_by / relates_to / discovered_from target. blocked_by holds the task back until target is done; a link that would make tasks wait on each other is refused. remove: true deletes the link.",
      inputSchema: z.object({
        task: z.string(),
        kind: z.enum(["blocked_by", "relates_to", "discovered_from"]),
        target: z.string(),
        remove: z.boolean().optional(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async (input) => {
      const command: LinkTasksCommand = {
        type: "tasks.link-tasks",
        ownerId,
        actor,
        task: input.task,
        kind: input.kind.replace("_", "-") as LinkKind,
        target: input.target,
        remove: input.remove,
      };
      return standing(input.task, await commandBus.dispatch(command));
    },
  );

  server.registerTool(
    "finish_session",
    {
      title: "Finish working on a task",
      description:
        "End your session with a handoff summary for whoever comes next: what was done, what is left, what to watch out for. outcome: done, in_review, paused, blocked (give reason) or released.",
      inputSchema: z.object({
        task: z.string(),
        outcome: z.enum(SESSION_OUTCOMES),
        summary: z.string().describe(MARKDOWN),
        reason: z.string().optional().describe("What it waits on, if blocked"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (input) => {
      const command: FinishSessionCommand = {
        type: "tasks.finish-session",
        ownerId,
        actor,
        task: input.task,
        outcome: input.outcome,
        summary: input.summary,
        reason: input.reason,
      };
      return standing(input.task, await commandBus.dispatch(command));
    },
  );

  server.registerTool(
    "set_status",
    {
      title: "Change a task's status",
      description:
        "Outside a session: move to backlog, todo, in_review or done, cancel, or reopen. hold puts it on hold with a reason; hold: null releases it. While you hold a session, use finish_session instead.",
      inputSchema: z.object({
        task: z.string(),
        status: z
          .enum(["backlog", "todo", "in_review", "done", "cancelled"])
          .optional(),
        hold: z.string().nullable().optional(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async (input) => {
      const command: ChangeStatusCommand = {
        type: "tasks.change-status",
        ownerId,
        actor,
        task: input.task,
        status: input.status,
        hold: input.hold,
      };
      return standing(input.task, await commandBus.dispatch(command));
    },
  );

  return server;
}

function workOnNextTask(repository: string | undefined): string {
  const pick = repository
    ? `Call list_tasks with ready: true and repository: "${repository}", then start_task with the first key it returns. If none is ready, say so and stop.`
    : "Call start_task without a task to claim the top ready one. If none is ready, say so and stop.";
  return `Work on the next task from fenro.

1. ${pick}
2. Read the brief it returns: the latest handoff and the decisions first, then the acceptance criteria.
3. Do the work. Record decisions, discoveries and open questions with add_note as you go, and file new work you find with save_task and discovered_from instead of doing it now.
4. check_criterion for each acceptance criterion you meet, with its evidence.
5. finish_session with a handoff summary and an outcome: done, in_review, paused, blocked (say on what) or released.`;
}

/**
 * Base64 grows a file by a third, and the whole tool call has to fit in one
 * request body, so inline pictures stop at 3 MB.
 */
const INLINE_PICTURE_BYTES = 3 * 1024 * 1024;
const INLINE_LIMIT_BASE64 = Math.ceil(INLINE_PICTURE_BYTES / 3) * 4;

function standingOf(task: TaskBrief) {
  return {
    key: task.key,
    title: task.title,
    status: task.status,
    state: task.state,
    hold: task.hold?.reason ?? null,
    labels: task.labels,
    criteria: task.acceptanceCriteria.map(
      (criterion) =>
        `${criterion.met ? "[x]" : "[ ]"} ${criterion.number}. ${criterion.text}`,
    ),
    session: task.session,
  };
}

function labelOf(label: LabelItem) {
  return {
    name: label.name,
    colour: label.colour,
    open_tasks: label.openTasks,
    tasks: label.tasks,
  };
}

function json(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value) }] };
}

function text(message: string, isError = false): CallToolResult {
  return { content: [{ type: "text", text: message }], isError };
}

function refused(error: TaskError): CallToolResult {
  return text(`${error.code}: ${error.message}`, true);
}
