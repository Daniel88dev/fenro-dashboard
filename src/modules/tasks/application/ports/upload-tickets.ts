import type { Actor } from "@/modules/tasks/domain";

export type UploadTicket = {
  readonly ownerId: string;
  readonly actor: Actor;
  readonly task: string;
  readonly pictureId: string;
  readonly name: string;
  readonly expiresAt: Date;
};

export interface UploadTickets {
  issue(ticket: UploadTicket): string;
  redeem(token: string, now: Date): UploadTicket | null;
}
