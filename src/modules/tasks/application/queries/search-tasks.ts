import { formatTaskKey, isOpen, parseTaskKey } from "@/modules/tasks/domain";
import type { Query, QueryHandler } from "@/shared/application";

import type { TaskReadStore, TaskRecord } from "../ports/task-read-store";
import { TaskIndex } from "./projections";
import type { TaskSearch, TaskSearchHit } from "./read-models";

export const SEARCH_GROUP_LIMIT = 8;
export const RECENT_LIMIT = 5;
export const DESCRIPTION_SCAN_LIMIT = 100;
export const SEARCH_TEXT_MAX = 200;

export type SearchTasksQuery = Query<"tasks.search-tasks", TaskSearch> & {
  readonly ownerId: string;
  readonly text: string;
  readonly descriptions: boolean;
};

export function searchTasksQuery(
  ownerId: string,
  text: string,
  descriptions = false,
): SearchTasksQuery {
  return { type: "tasks.search-tasks", ownerId, text, descriptions };
}

const NOTHING: TaskSearch = {
  recent: [],
  byNumber: [],
  tasks: [],
  epics: [],
  inDescriptions: [],
  moreInDescriptions: 0,
};

export class SearchTasksHandler implements QueryHandler<
  SearchTasksQuery,
  TaskSearch
> {
  constructor(
    private readonly tasks: TaskReadStore,
    private readonly clock: () => Date,
  ) {}

  async handle(query: SearchTasksQuery): Promise<TaskSearch> {
    const text = query.text.trim().slice(0, SEARCH_TEXT_MAX);
    const index = new TaskIndex(
      await this.tasks.records(query.ownerId),
      this.clock(),
    );
    const hit = (record: TaskRecord, excerpt: string | null = null) =>
      searchHit(index, record, excerpt);

    if (!text) {
      return {
        ...NOTHING,
        recent: index.records
          .filter((record) => record.status !== "cancelled")
          .sort(byRecentChange)
          .slice(0, RECENT_LIMIT)
          .map((record) => hit(record)),
      };
    }

    const number = parseTaskKey(text);
    const byNumber = number.ok
      ? index.records
          .filter((record) =>
            String(record.number).startsWith(String(number.value)),
          )
          .sort(
            (a, b) =>
              Number(b.number === number.value) -
                Number(a.number === number.value) || a.number - b.number,
          )
          .slice(0, SEARCH_GROUP_LIMIT)
      : [];

    const numbered = new Set(byNumber.map((record) => record.id));
    const words = searchWords(text);
    const inTitle = index.records
      .filter((record) => {
        if (numbered.has(record.id)) return false;
        const title = record.title.toLowerCase();
        return words.every((word) => title.includes(word));
      })
      .sort(byRelevance);
    const titled = new Set(inTitle.map((record) => record.id));

    const described = number.ok
      ? []
      : (
          await this.tasks.descriptionsContaining(
            query.ownerId,
            words,
            DESCRIPTION_SCAN_LIMIT,
          )
        ).filter(({ id }) => !titled.has(id) && index.get(id));

    return {
      recent: [],
      byNumber: byNumber.map((record) => hit(record)),
      tasks: inTitle
        .filter((record) => record.kind === "task")
        .slice(0, SEARCH_GROUP_LIMIT)
        .map((record) => hit(record)),
      epics: inTitle
        .filter((record) => record.kind === "epic")
        .slice(0, SEARCH_GROUP_LIMIT)
        .map((record) => hit(record)),
      inDescriptions: query.descriptions
        ? described
            .map(({ id, description }) => ({
              record: index.get(id)!,
              description,
            }))
            .sort((a, b) => byRelevance(a.record, b.record))
            .slice(0, SEARCH_GROUP_LIMIT)
            .map(({ record, description }) =>
              hit(record, excerpt(description, words)),
            )
        : [],
      moreInDescriptions: query.descriptions ? 0 : described.length,
    };
  }
}

export function searchWords(text: string): string[] {
  return text.toLowerCase().split(/\s+/).filter(Boolean);
}

const EXCERPT_BEFORE = 40;
const EXCERPT_AFTER = 90;

export function excerpt(description: string, words: readonly string[]) {
  const flat = description.replace(/\s+/g, " ").trim();
  const lower = flat.toLowerCase();
  const found = words
    .map((word) => lower.indexOf(word))
    .filter((position) => position >= 0);
  const from = found.length > 0 ? Math.min(...found) : 0;
  const start = Math.max(0, from - EXCERPT_BEFORE);
  const end = Math.min(flat.length, from + EXCERPT_AFTER);
  return `${start > 0 ? "…" : ""}${flat.slice(start, end)}${end < flat.length ? "…" : ""}`;
}

function searchHit(
  index: TaskIndex,
  record: TaskRecord,
  excerpt: string | null,
): TaskSearchHit {
  return {
    key: formatTaskKey(record.number),
    kind: record.kind,
    title: record.title,
    state: index.state(record),
    repository: record.repository
      ? `${record.repository.owner}/${record.repository.name}`
      : null,
    progress: index.progress(record),
    excerpt,
  };
}

function byRecentChange(a: TaskRecord, b: TaskRecord) {
  return b.updatedAt.getTime() - a.updatedAt.getTime();
}

function byRelevance(a: TaskRecord, b: TaskRecord) {
  return (
    Number(isOpen(b.status)) - Number(isOpen(a.status)) || byRecentChange(a, b)
  );
}
