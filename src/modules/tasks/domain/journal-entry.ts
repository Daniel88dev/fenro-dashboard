import type { Actor } from "./actor";

/**
 * What kind of thing a session learned. `handoff` is written only by finishing
 * a session, so the latest one is always the summary the next session should
 * read first.
 */
export const JOURNAL_KINDS = [
  "note",
  "decision",
  "discovery",
  "question",
  "handoff",
] as const;

export type JournalKind = (typeof JOURNAL_KINDS)[number];

/** The kinds anyone may append directly. */
export type NoteKind = Exclude<JournalKind, "handoff">;

export const NOTE_KINDS: readonly NoteKind[] = [
  "note",
  "decision",
  "discovery",
  "question",
];

/** Long enough for a real finding, short enough that a brief stays readable. */
export const JOURNAL_TEXT_LIMIT = 20_000;

/**
 * One thing recorded on a task: the context a task carries from one session to
 * the next. Append-only by design — if a later session could rewrite what an
 * earlier one recorded, the handoff would stop being trustworthy (ticket 08).
 * A correction is a new entry.
 */
export type JournalEntry = {
  readonly id: string;
  readonly kind: JournalKind;
  readonly text: string;
  readonly author: Actor;
  /** The session it was written in, if any. */
  readonly sessionId: string | null;
  readonly recordedAt: Date;
};
