import { describe, expect, it } from "vitest";

import { parseKeyPrefix, suggestKeyPrefix } from "./key-prefix";
import { Group, type Person } from "./group";

const now = new Date("2026-10-19T12:00:00Z");
const daniel: Person = { id: "user-daniel", login: "Daniel88dev" };
const ana: Person = { id: "user-ana", login: "ana-k" };

function hal(): Group {
  const created = Group.create({
    id: "org-hal",
    name: "  Halcyon   Labs ",
    prefix: "hal",
    owner: daniel,
    now,
  });
  if (!created.ok) throw new Error(created.error.message);
  return created.value;
}

function withAna(): Group {
  const group = hal();
  group.invite(daniel, "ANA-K", now);
  group.accept(ana, now);
  return group;
}

describe("key prefix", () => {
  it("upper-cases two to five letters", () => {
    expect(parseKeyPrefix(" lar ")).toEqual({ ok: true, value: "LAR" });
    expect(parseKeyPrefix("ABCDE").ok).toBe(true);
  });

  it("refuses T, digits and long prefixes", () => {
    expect(parseKeyPrefix("T").ok).toBe(false);
    expect(parseKeyPrefix("A1").ok).toBe(false);
    expect(parseKeyPrefix("ABCDEF").ok).toBe(false);
  });

  it("suggests the first letters of the name", () => {
    expect(suggestKeyPrefix("Larkspur studio")).toBe("LAR");
  });
});

describe("Group", () => {
  it("starts with its creator as the only owner", () => {
    const group = hal();

    expect(group.name).toBe("Halcyon Labs");
    expect(group.prefix).toBe("HAL");
    expect(group.state.members).toEqual([
      { userId: daniel.id, login: daniel.login, role: "owner", joinedAt: now },
    ]);
    expect(group.pullDomainEvents()).toHaveLength(1);
  });

  it("refuses an empty name", () => {
    const created = Group.create({
      id: "org",
      name: "  ",
      prefix: "HAL",
      owner: daniel,
      now,
    });

    expect(created.ok).toBe(false);
  });

  it("lets an invited login join, ignoring case", () => {
    const group = withAna();

    expect(group.memberOf(ana.id)?.role).toBe("member");
    expect(group.state.invitations).toEqual([]);
  });

  it("refuses a second invitation to the same login", () => {
    const group = hal();
    group.invite(daniel, "ana-k", now);

    const again = group.invite(daniel, "Ana-K", now);

    expect(again.ok || again.error.code).toBe("already-invited");
  });

  it("refuses inviting someone who is already a member", () => {
    const invited = hal().invite(daniel, "daniel88DEV", now);

    expect(invited.ok || invited.error.code).toBe("already-a-member");
  });

  it("only lets owners invite", () => {
    const group = withAna();

    const invited = group.invite(ana, "someone", now);

    expect(invited.ok || invited.error.code).toBe("not-an-owner");
  });

  it("refuses to join without an invitation", () => {
    const joined = hal().accept(ana, now);

    expect(joined.ok || joined.error.code).toBe("invitation-not-found");
  });

  it("keeps at least one owner", () => {
    const group = withAna();

    const left = group.leave(daniel, now);
    const demoted = group.changeRole(daniel, daniel.id, "member");

    expect(left.ok || left.error.code).toBe("last-owner");
    expect(demoted.ok || demoted.error.code).toBe("last-owner");
  });

  it("lets the last owner leave once someone else owns it", () => {
    const group = withAna();
    group.changeRole(daniel, ana.id, "owner");

    expect(group.leave(daniel, now).ok).toBe(true);
    expect(group.memberOf(daniel.id)).toBeUndefined();
  });

  it("treats removing yourself as leaving", () => {
    const group = withAna();

    expect(group.remove(ana, ana.id, now).ok).toBe(true);
    expect(group.memberOf(ana.id)).toBeUndefined();
  });

  it("only lets owners remove other members", () => {
    const group = withAna();

    const removed = group.remove(ana, daniel.id, now);

    expect(removed.ok || removed.error.code).toBe("not-an-owner");
  });
});
