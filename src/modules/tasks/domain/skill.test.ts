import { describe, expect, it } from "vitest";

import { unwrap } from "@/shared/domain";

import type { Actor } from "./actor";
import { MAX_SKILL_LABELS, Skill, type NewSkill } from "./skill";

const daniel: Actor = { kind: "human", id: "user-1", name: "Daniel" };
const claude: Actor = { kind: "agent", id: "token-1", name: "claude-code" };
const t0 = new Date("2026-10-04T10:00:00Z");
const t1 = new Date("2026-10-04T11:00:00Z");

const aSkill = (overrides: Partial<NewSkill> = {}) =>
  Skill.create({
    id: "skill-1",
    ownerId: "user-1",
    name: "frontend-conventions",
    description: "Use when building or changing UI.",
    instructions: "## Tokens, not dark: classes",
    actor: daniel,
    now: t0,
    ...overrides,
  });

describe("a skill", () => {
  it("keeps the Agent Skills name rule, lower-casing what it can", () => {
    expect(unwrap(aSkill({ name: " Frontend Conventions " })).name).toBe(
      "frontend-conventions",
    );
    for (const name of ["-lead", "two--hyphens", "dots.no", "x".repeat(65)]) {
      const refused = aSkill({ name });
      expect(!refused.ok && refused.error.code).toBe("invalid-skill");
    }
  });

  it("needs a description and instructions within their limits", () => {
    const blank = aSkill({ description: "  " });
    expect(!blank.ok && blank.error.code).toBe("invalid-skill");
    const long = aSkill({ instructions: "x".repeat(20_001) });
    expect(!long.ok && long.error.code).toBe("invalid-skill");
  });

  it("holds its labels normalised, once each, sorted", () => {
    const skill = unwrap(aSkill({ labels: ["UI", "frontend", "ui"] }));
    expect(skill.state.labels).toEqual(["frontend", "ui"]);

    const bad = aSkill({ labels: ["no, commas"] });
    expect(!bad.ok && bad.error.code).toBe("invalid-label");
  });

  it("starts at revision 1, kept for the store", () => {
    const skill = unwrap(aSkill());
    expect(skill.state.revision).toBe(1);
    expect(skill.pullNewRevisions()).toMatchObject([
      { revision: 1, by: daniel },
    ]);
    expect(skill.pullNewRevisions()).toEqual([]);
  });

  it("makes a revision for a change to the text, by whoever made it", () => {
    const skill = unwrap(aSkill());
    skill.pullNewRevisions();

    expect(
      skill.revise({ instructions: "## Use tokens" }, 1, claude, t1).ok,
    ).toBe(true);
    expect(skill.state).toMatchObject({
      revision: 2,
      instructions: "## Use tokens",
      description: "Use when building or changing UI.",
      updatedBy: claude,
      updatedAt: t1,
    });
    expect(skill.pullNewRevisions()).toMatchObject([
      { revision: 2, instructions: "## Use tokens", by: claude },
    ]);
  });

  it("refuses a change made against an older revision", () => {
    const skill = unwrap(aSkill());
    skill.revise({ description: "Use for UI work." }, 1, claude, t1);

    const stale = skill.revise({ description: "Mine" }, 1, daniel, t1);
    expect(!stale.ok && stale.error.code).toBe("stale-skill");
    expect(skill.state.description).toBe("Use for UI work.");
  });

  it("makes no revision when the text stays as it is", () => {
    const skill = unwrap(aSkill());
    skill.pullNewRevisions();
    skill.revise({ name: "Frontend-Conventions" }, 1, claude, t1);
    expect(skill.state.revision).toBe(1);
    expect(skill.pullNewRevisions()).toEqual([]);
  });

  it("links and unlinks labels without a revision, up to the limit", () => {
    const skill = unwrap(aSkill({ labels: ["ui"] }));

    expect(skill.link(["Frontend", "ui"], claude, t1).ok).toBe(true);
    expect(skill.state.labels).toEqual(["frontend", "ui"]);
    expect(skill.state.revision).toBe(1);
    expect(skill.state.updatedBy).toEqual(claude);

    skill.unlink(["ui", "never-linked"], daniel, t1);
    expect(skill.state.labels).toEqual(["frontend"]);

    const many = Array.from({ length: MAX_SKILL_LABELS }, (_, i) => `l${i}`);
    const tooMany = skill.link(many, daniel, t1);
    expect(!tooMany.ok && tooMany.error.code).toBe("invalid-skill");
    expect(skill.state.labels).toEqual(["frontend"]);
  });
});
