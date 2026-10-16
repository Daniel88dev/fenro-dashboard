import type { Actor } from "./actor";

/**
 * `handoff` is written only by finishing a session, so the latest one is
 * always the summary the next session should read first.
 */
export const JOURNAL_KINDS = [
  "note",
  "decision",
  "discovery",
  "question",
  "handoff",
] as const;

export type JournalKind = (typeof JOURNAL_KINDS)[number];

export type NoteKind = Exclude<JournalKind, "handoff">;

export const NOTE_KINDS: readonly NoteKind[] = [
  "note",
  "decision",
  "discovery",
  "question",
];

export const JOURNAL_TEXT_LIMIT = 20_000;

/**
 * Append-only: if a later session could rewrite what an earlier one
 * recorded, the handoff would stop being trustworthy.
 */
export type JournalEntry = {
  readonly id: string;
  readonly kind: JournalKind;
  readonly text: string;
  readonly author: Actor;
  readonly sessionId: string | null;
  readonly recordedAt: Date;
};
