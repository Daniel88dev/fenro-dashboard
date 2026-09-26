import type { Actor } from "@/modules/tasks/domain";

/**
 * What an upload ticket lets its bearer do: add one picture, named up front,
 * to one task, as the agent it was issued to.
 */
export type UploadTicket = {
  readonly ownerId: string;
  readonly actor: Actor;
  readonly task: string;
  readonly pictureId: string;
  readonly name: string;
  readonly expiresAt: Date;
};

/**
 * Tickets for sending a picture's bytes straight to the app, so an agent with
 * a shell can upload a file with curl instead of pasting it into a tool call.
 * A ticket is self-contained and tamper-proof; it needs no storage.
 */
export interface UploadTickets {
  issue(ticket: UploadTicket): string;
  /** The ticket a token stands for, or null if it is forged or expired. */
  redeem(token: string, now: Date): UploadTicket | null;
}
