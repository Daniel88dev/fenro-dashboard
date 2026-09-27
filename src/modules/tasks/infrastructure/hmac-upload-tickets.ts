import { createHmac, timingSafeEqual } from "node:crypto";

import type {
  UploadTicket,
  UploadTickets,
} from "@/modules/tasks/application/ports/upload-tickets";

type Claims = {
  readonly o: string;
  readonly a: {
    readonly k: "agent" | "human";
    readonly i: string;
    readonly n: string;
  };
  readonly t: string;
  readonly p: string;
  readonly f: string;
  readonly e: number;
};

/**
 * Upload tickets as signed tokens: the claims in base64url, a dot, and an
 * HMAC over them. The key is derived from the app's secret for this one
 * purpose, so a ticket can never pass for anything else the secret signs.
 */
export class HmacUploadTickets implements UploadTickets {
  readonly #key: Buffer;

  constructor(secret: string) {
    this.#key = createHmac("sha256", secret)
      .update("fenro:picture-upload-ticket")
      .digest();
  }

  issue(ticket: UploadTicket): string {
    const claims: Claims = {
      o: ticket.ownerId,
      a: { k: ticket.actor.kind, i: ticket.actor.id, n: ticket.actor.name },
      t: ticket.task,
      p: ticket.pictureId,
      f: ticket.name,
      e: ticket.expiresAt.getTime(),
    };
    const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
    return `${body}.${this.#sign(body)}`;
  }

  redeem(token: string, now: Date): UploadTicket | null {
    const [body, signature, ...rest] = token.split(".");
    if (!body || !signature || rest.length > 0) return null;
    const expected = Buffer.from(this.#sign(body));
    const given = Buffer.from(signature);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      return null;
    }
    let claims: Claims;
    try {
      claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    } catch {
      return null;
    }
    if (claims.e <= now.getTime()) return null;
    return {
      ownerId: claims.o,
      actor: { kind: claims.a.k, id: claims.a.i, name: claims.a.n },
      task: claims.t,
      pictureId: claims.p,
      name: claims.f,
      expiresAt: new Date(claims.e),
    };
  }

  #sign(body: string): string {
    return createHmac("sha256", this.#key).update(body).digest("base64url");
  }
}
