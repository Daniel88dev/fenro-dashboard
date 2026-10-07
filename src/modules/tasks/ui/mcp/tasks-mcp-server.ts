import { McpServer, type CallToolResult } from "@modelcontextprotocol/server";
import { z } from "zod";

import type { AddPictureCommand } from "@/modules/tasks/application/commands/add-picture";
import type { ChangeStatusCommand } from "@/modules/tasks/application/commands/change-status";
import type { CreateLabelCommand } from "@/modules/tasks/application/commands/create-label";
import type { CheckCriterionCommand } from "@/modules/tasks/application/commands/check-criterion";
import type { CreateSkillCommand } from "@/modules/tasks/application/commands/create-skill";
import type { CreateTaskCommand } from "@/modules/tasks/application/commands/create-task";
import type { FinishSessionCommand } from "@/modules/tasks/application/commands/finish-session";
import type { LinkSkillCommand } from "@/modules/tasks/application/commands/link-skill";
import type { LinkTasksCommand } from "@/modules/tasks/application/commands/link-tasks";
import type { RecolourLabelCommand } from "@/modules/tasks/application/commands/recolour-label";
import type { RecordNoteCommand } from "@/modules/tasks/application/commands/record-note";
import type { RenameLabelCommand } from "@/modules/tasks/application/commands/rename-label";
import type { RestoreSkillCommand } from "@/modules/tasks/application/commands/restore-skill";
import type { ReviseSkillCommand } from "@/modules/tasks/application/commands/revise-skill";
import type { StartTaskCommand } from "@/modules/tasks/application/commands/start-task";
import type { UnlinkSkillCommand } from "@/modules/tasks/application/commands/unlink-skill";
import type { UpdateTaskCommand } from "@/modules/tasks/application/commands/update-task";
import { listLabelsQuery } from "@/modules/tasks/application/queries/list-labels";
import { listSkillsQuery } from "@/modules/tasks/application/queries/list-skills";
import { listTasksQuery } from "@/modules/tasks/application/queries/list-tasks";
import { pictureContentQuery } from "@/modules/tasks/application/queries/picture";
import type { PictureUploadTicketQuery } from "@/modules/tasks/application/queries/picture-upload-ticket";
import type {
  BriefSkill,
  LabelItem,
  SkillDetail,
  SkillItem,
  TaskBrief,
} from "@/modules/tasks/application/queries/read-models";
import { skillQuery } from "@/modules/tasks/application/queries/skill";
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
import { ok, type Result } from "@/shared/domain";

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

/**
 * Skills are prompts a person wrote for a kind of work, so the agent is told
 * plainly where they rank: below the person and the task, which are specific,
 * above its own habits.
 */
export const SKILLS = `Skills: a skill is a set of instructions a person linked to labels, such as how frontend work is done here. start_task returns every skill linked to the task's own labels in full: follow them while you work the task. When they conflict, the person's own words in this session win, then the task's description and acceptance criteria, then the skills. A skill whose instructions come back null did not fit in the brief: read it with get_skill. get_task lists the skills by name only; get_skill reads one, and list_skills lists them all. If a skill is wrong or out of date, say so with add_note, and change it with save_skill only when asked to; every change is kept and can be restored.`;

export const INSTRUCTIONS = `Fenro is the task list you work from. Tasks carry context between sessions, so record what you learn as you go.

The loop:
1. list_tasks with ready: true, or start_task without a task to take the top ready one.
2. start_task claims the task and returns its brief. Read the latest handoff and the decisions first. The claim lapses after 2 hours without a call, so another agent can take over if you stop.
3. While working, add_note for decisions, discoveries and open questions. File new work you find with save_task and discovered_from, rather than doing it now.
4. check_criterion for each acceptance criterion with its evidence.
5. finish_session with a handoff summary and an outcome: done, in_review (a person must look, e.g. a pull request is open), paused, blocked (say on what), or released (give it back).

A task is not done while it has open sub-tasks or unmet criteria. Tasks are named by key, like T-12; a person may paste a task's link instead (…/tasks/T-12), which works wherever a key does. A task can sit under a parent, like an epic: get_task shows its parent and sub-tasks, save_task with parent moves it, and list_tasks with parent lists a parent's sub-tasks.

Labels group tasks, and the person filters their list by them. Reuse the labels list_labels returns before inventing new ones; a name that does not exist yet is created when a task is saved with it.

${SKILLS}

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
    /** A task page's full address, to hand back to people. */
    readonly task: (key: string) => string;
  },
): McpServer {
  const { ownerId, actor } = access;
  const { commandBus, queryBus } = buses;
  const server = new McpServer(
    { name: "fenro-tasks", version: "1.0.0" },
    { instructions: INSTRUCTIONS },
  );

  const brief = async (
    task: string,
    journalLimit?: number,
    skillInstructions = false,
  ) =>
    queryBus.ask(
      taskBriefQuery(ownerId, task, journalLimit, { skillInstructions }),
    );
  const url = (key: string) => ({ url: links.task(key) });

  /** After a change, answer with where the task now stands. */
  const standing = async (
    task: string,
    outcome: Result<void, TaskError>,
  ): Promise<CallToolResult> => {
    if (!outcome.ok) return refused(outcome.error);
    const found = await brief(task, 0);
    return found.ok
      ? json({ ...standingOf(found.value), ...url(found.value.key) })
      : refused(found.error);
  };

  /** After a skill changes, answer with where it now stands, without its text. */
  const savedSkill = async (
    skill: string,
    outcome: Result<void, TaskError>,
  ): Promise<CallToolResult> => {
    if (!outcome.ok) return refused(outcome.error);
    const found = await queryBus.ask(skillQuery(ownerId, skill, 1));
    return found.ok ? json(skillOf(found.value)) : refused(found.error);
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
        "The full brief for one task: description, acceptance criteria, its parent, blockers, sub-tasks, links, the latest handoff, every decision, the recent journal, the task's pictures, the skills its labels bring (by name; start_task gives their text) and its url to share with people.",
      inputSchema: z.object({
        task: z.string().describe("Key, e.g. T-12, or the task's link"),
        journal_limit: z.number().int().min(0).max(200).optional(),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ task, journal_limit }) => {
      const found = await brief(task, journal_limit);
      return found.ok
        ? json({
            ...found.value,
            skills: found.value.skills.map(skillSummaryOf),
            ...url(found.value.key),
          })
        : refused(found.error);
    },
  );

  server.registerTool(
    "list_labels",
    {
      title: "List labels",
      description:
        "The labels tasks can carry, with each one's colour, how many open tasks carry it and the skills it brings. Reuse these names in save_task and list_tasks.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () =>
      json((await queryBus.ask(listLabelsQuery(ownerId))).map(labelOf)),
  );

  server.registerTool(
    "list_skills",
    {
      title: "List skills",
      description:
        "The skills: instructions a person linked to labels, which tasks carrying those labels bring. Name, description (when to use it), labels and revision; get_skill reads one in full.",
      inputSchema: z.object({
        label: z
          .string()
          .optional()
          .describe("Only skills linked to this label"),
        text: z
          .string()
          .optional()
          .describe("Words in the name or description"),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (input) =>
      json(
        (
          await queryBus.ask(
            listSkillsQuery(ownerId, { label: input.label, text: input.text }),
          )
        ).map(skillOf),
      ),
  );

  server.registerTool(
    "get_skill",
    {
      title: "Read a skill",
      description:
        "One skill in full: its instructions (Markdown) and who changed it when. Give revision to also read the text it had at an earlier revision.",
      inputSchema: z.object({
        skill: z
          .string()
          .describe("The skill's name, e.g. frontend-conventions"),
        revision: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("An earlier revision whose text to include"),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ skill, revision }) => {
      const found = await queryBus.ask(skillQuery(ownerId, skill));
      if (!found.ok) return refused(found.error);
      const detail = found.value;
      if (revision === undefined) return json(skillDetailOf(detail));

      // The history is newest first, so reaching back to a revision means
      // asking for as many as lie between it and the current one.
      const reach = detail.revision - revision + 1;
      const history =
        reach > detail.revisions.length
          ? await queryBus.ask(skillQuery(ownerId, detail.id, reach))
          : found;
      const old = history.ok
        ? history.value.revisions.find((item) => item.revision === revision)
        : undefined;
      if (!old) {
        return text(
          `invalid-skill: Skill "${detail.name}" has no revision ${revision}; it is at revision ${detail.revision}.`,
          true,
        );
      }
      return json({
        ...skillDetailOf(detail),
        requested_revision: {
          revision: old.revision,
          name: old.name,
          description: old.description,
          instructions: old.instructions,
          by: old.by,
          at: old.at,
        },
      });
    },
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
          .describe(
            "Key of the parent task (like an epic) it goes under; null makes it top-level",
          ),
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
    "save_label",
    {
      title: "Create, rename or recolour a label",
      description:
        "With a name no label has, creates it. With an existing label's name, new_name renames it everywhere (tasks and skills keep it) and colour recolours it. Labels cannot be deleted.",
      inputSchema: z.object({
        name: z.string().describe("The label's name, or the new label's"),
        new_name: z.string().optional().describe("Rename an existing label"),
        colour: z.enum(LABEL_COLOURS).optional(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async (input) => {
      const current = normaliseLabelName(input.name);
      const exists = (await queryBus.ask(listLabelsQuery(ownerId))).some(
        (label) => label.name === current,
      );

      if (!exists) {
        if (input.new_name !== undefined) {
          return text(
            `label-not-found: There is no label "${current}" to rename. List labels to see their names, or leave new_name out to create it.`,
            true,
          );
        }
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
      }

      if (exists && input.colour) {
        const command: RecolourLabelCommand = {
          type: "tasks.recolour-label",
          ownerId,
          actor,
          label: current,
          colour: input.colour,
        };
        const recoloured = await commandBus.dispatch(command);
        if (!recoloured.ok) return refused(recoloured.error);
      }

      let name = current;
      if (exists && input.new_name !== undefined) {
        const command: RenameLabelCommand = {
          type: "tasks.rename-label",
          ownerId,
          actor,
          label: current,
          name: input.new_name,
        };
        const renamed = await commandBus.dispatch(command);
        if (!renamed.ok) return refused(renamed.error);
        name = normaliseLabelName(input.new_name);
      }

      const label = (await queryBus.ask(listLabelsQuery(ownerId))).find(
        (candidate) => candidate.name === name,
      );
      return json(label ? labelOf(label) : { name });
    },
  );

  server.registerTool(
    "save_skill",
    {
      title: "Create or change a skill",
      description:
        "Without skill, creates one: name, description and instructions are required. With skill, changes only what is given; changing the name, description or instructions, or restoring an earlier revision, needs the revision you read, so you never overwrite a change you have not seen. Every change is kept as a revision a person can restore. Linking a label applies the skill to every task carrying it.",
      inputSchema: z.object({
        skill: z
          .string()
          .optional()
          .describe("Name of the skill to change; left out, one is created"),
        name: z
          .string()
          .optional()
          .describe(
            "Lower-case words joined by hyphens, e.g. frontend-conventions",
          ),
        description: z
          .string()
          .optional()
          .describe("When to use it, in a sentence or two"),
        instructions: z.string().optional().describe(MARKDOWN),
        revision: z
          .number()
          .int()
          .optional()
          .describe("On change: the revision you read with get_skill"),
        restore: z
          .number()
          .int()
          .optional()
          .describe("On change: an earlier revision whose text comes back"),
        labels: z
          .array(z.string())
          .optional()
          .describe(
            "Replaces the labels it applies through; new names are created",
          ),
        add_labels: z
          .array(z.string())
          .optional()
          .describe("Labels to link, keeping the rest"),
        remove_labels: z
          .array(z.string())
          .optional()
          .describe("On change: labels to unlink"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async (input) => {
      if (!input.skill) {
        if (!input.name || !input.description || !input.instructions) {
          return text(
            "Give name, description and instructions to create a skill, or a skill's name to change one.",
            true,
          );
        }
        const skillId = crypto.randomUUID();
        const command: CreateSkillCommand = {
          type: "tasks.create-skill",
          ownerId,
          actor,
          skillId,
          name: input.name,
          description: input.description,
          instructions: input.instructions,
          labels: [...(input.labels ?? []), ...(input.add_labels ?? [])],
        };
        return savedSkill(skillId, await commandBus.dispatch(command));
      }

      // Every change goes by id, so a rename in the same call does not lose
      // the skill for the steps after it.
      const found = await queryBus.ask(skillQuery(ownerId, input.skill, 1));
      if (!found.ok) return refused(found.error);
      const skill = found.value.id;

      const rewrites =
        input.name !== undefined ||
        input.description !== undefined ||
        input.instructions !== undefined;
      if (rewrites || input.restore !== undefined) {
        if (input.revision === undefined) {
          return text(
            `stale-skill: Give the revision you read (get_skill says ${found.value.revision}) to change a skill's text, so you never overwrite a change you have not seen.`,
            true,
          );
        }
        if (rewrites && input.restore !== undefined) {
          return text(
            "invalid-skill: Restore an earlier revision or give new text, not both in one call.",
            true,
          );
        }
        const command: ReviseSkillCommand | RestoreSkillCommand =
          input.restore !== undefined
            ? {
                type: "tasks.restore-skill",
                ownerId,
                actor,
                skill,
                revision: input.restore,
                expectedRevision: input.revision,
              }
            : {
                type: "tasks.revise-skill",
                ownerId,
                actor,
                skill,
                expectedRevision: input.revision,
                name: input.name,
                description: input.description,
                instructions: input.instructions,
              };
        const revised = await commandBus.dispatch(command);
        if (!revised.ok) return refused(revised.error);
      }

      const linked = new Set(found.value.labels);
      const wanted = input.labels?.map(normaliseLabelName);
      const link = [
        ...(wanted ?? []).filter((name) => !linked.has(name)),
        ...(input.add_labels ?? []),
      ];
      const unlink = [
        ...(wanted ? [...linked].filter((name) => !wanted.includes(name)) : []),
        ...(input.remove_labels ?? []),
      ];
      if (link.length > 0) {
        const command: LinkSkillCommand = {
          type: "tasks.link-skill",
          ownerId,
          actor,
          skill,
          labels: link,
        };
        const done = await commandBus.dispatch(command);
        if (!done.ok) return refused(done.error);
      }
      if (unlink.length > 0) {
        const command: UnlinkSkillCommand = {
          type: "tasks.unlink-skill",
          ownerId,
          actor,
          skill,
          labels: unlink,
        };
        const done = await commandBus.dispatch(command);
        if (!done.ok) return refused(done.error);
      }
      return savedSkill(skill, ok(undefined));
    },
  );

  server.registerTool(
    "start_task",
    {
      title: "Start working on a task",
      description:
        "Claims a task for you and returns its brief, with the full instructions of every skill its labels bring: follow them while you work it. Without task, takes the top ready one. Starting a task you already hold resumes your session.",
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
          const found = await brief(candidate, undefined, true);
          return found.ok
            ? json({ ...found.value, ...url(found.value.key) })
            : refused(found.error);
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
2. Read the brief it returns: the latest handoff and the decisions first, then the acceptance criteria, then its skills. Follow the skills while you work; where they conflict, what the person said wins, then the task's description and criteria, then the skills.
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
    skills: label.skills,
  };
}

/** A skill on a task the agent is only looking at: enough to know it is there. */
function skillSummaryOf(skill: BriefSkill) {
  return {
    name: skill.name,
    description: skill.description,
    via: skill.via,
    revision: skill.revision,
  };
}

function skillOf(skill: SkillItem) {
  return {
    name: skill.name,
    description: skill.description,
    labels: skill.labels,
    revision: skill.revision,
    open_tasks: skill.openTasks,
    updated_by: skill.updatedBy,
    updated_at: skill.updatedAt,
  };
}

function skillDetailOf(skill: SkillDetail) {
  return {
    ...skillOf(skill),
    instructions: skill.instructions,
    created_by: skill.createdBy,
    created_at: skill.createdAt,
    revisions: skill.revisions.map((revision) => ({
      revision: revision.revision,
      name: revision.name,
      by: revision.by,
      by_kind: revision.byKind,
      at: revision.at,
    })),
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
