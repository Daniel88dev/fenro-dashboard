import type { TaskState } from "@/modules/tasks/application/queries/read-models";

/**
 * The tasks the approved prototype drew. Invented, like every other number in
 * the sample data, and replaced the moment the `Task` aggregate exists.
 */

export type SampleTask = {
  readonly id: string;
  readonly title: string;
  readonly lastActivity: string;
  readonly state: TaskState;
  readonly contextItems: number;
};

export type SampleRepositoryTasks = {
  readonly owner: string;
  readonly name: string;
  readonly total: number;
  readonly running: number;
  readonly hint: string;
  readonly summary: string;
  readonly tasks: readonly SampleTask[];
};

export const SAMPLE_TASKS: readonly SampleRepositoryTasks[] = [
  {
    owner: "nordwind",
    name: "billing-core",
    total: 5,
    running: 1,
    hint: "1 running",
    summary: "1 session running, 2 blocked",
    tasks: [
      {
        id: "T-104",
        title: "Make the settlement reducer two aggregates",
        lastActivity: "Session 3 running, 18 min in",
        state: "running",
        contextItems: 14,
      },
      {
        id: "T-091",
        title: "Decide the rounding rule for refunds",
        lastActivity: "Blocked on finance since 9 Sept",
        state: "blocked",
        contextItems: 6,
      },
      {
        id: "T-101",
        title: "Merge the invoice serializer removal",
        lastActivity: "Approved, CI green, nothing left to do",
        state: "ready",
        contextItems: 4,
      },
    ],
  },
  {
    owner: "Daniel88dev",
    name: "fenro-api",
    total: 3,
    running: 0,
    hint: "1 paused",
    summary: "1 paused, 2 not started",
    tasks: [
      {
        id: "T-098",
        title: "Finish the read-model cache decorator",
        lastActivity: "Paused after session 2, 6 days ago",
        state: "paused",
        contextItems: 9,
      },
      {
        id: "T-093",
        title: "Give every command a correlation id",
        lastActivity: "Not started",
        state: "queued",
        contextItems: 2,
      },
    ],
  },
  {
    owner: "nordwind",
    name: "edge-proxy",
    total: 2,
    running: 0,
    hint: "none running",
    summary: "2 not started",
    tasks: [
      {
        id: "T-088",
        title: "Port the rate limiter to the edge worker",
        lastActivity: "Not started",
        state: "queued",
        contextItems: 3,
      },
    ],
  },
  {
    owner: "Daniel88dev",
    name: "fenro-dashboard",
    total: 6,
    running: 2,
    hint: "2 running",
    summary: "2 sessions running",
    tasks: [
      {
        id: "T-112",
        title: "Build the expanding repository table",
        lastActivity: "Session 1 running, 6 min in",
        state: "running",
        contextItems: 5,
      },
      {
        id: "T-110",
        title: "Decide what a task carries into a new session",
        lastActivity: "Session 2 running, 22 min in",
        state: "running",
        contextItems: 11,
      },
    ],
  },
  {
    owner: "nordwind",
    name: "docs-site",
    total: 1,
    running: 0,
    hint: "none running",
    summary: "1 not started",
    tasks: [
      {
        id: "T-084",
        title: "Write the AWS deployment page",
        lastActivity: "Not started",
        state: "queued",
        contextItems: 1,
      },
    ],
  },
  {
    owner: "Daniel88dev",
    name: "fenro-worker",
    total: 0,
    running: 0,
    hint: "no tasks",
    summary: "no tasks yet",
    tasks: [],
  },
];
