import { AggregateRoot, err, ok, UniqueId, type Result } from "@/shared/domain";

import type { Actor } from "./actor";
import { taskError, type TaskError } from "./errors";
import {
  SkillCreated,
  SkillDeleted,
  SkillLinked,
  SkillRevised,
  SkillUnlinked,
} from "./events";
import { parseLabelName } from "./label";

/** The Agent Skills rule for `name`, so a skill can be exported as SKILL.md. */
const SKILL_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const MAX_SKILL_NAME = 64;
export const MAX_SKILL_DESCRIPTION = 1024;
/** Keeps a brief that carries several skills affordable for an agent. */
export const MAX_SKILL_INSTRUCTIONS = 20_000;
export const MAX_SKILL_LABELS = 20;

/** What a revision changes: the text, never the labels. */
export type SkillText = {
  readonly name: string;
  readonly description: string;
  readonly instructions: string;
};

/**
 * The text a skill had at one revision, and who wrote it. Every revision is
 * kept, so an agent's edit can be read and undone.
 */
export type SkillRevision = SkillText & {
  readonly revision: number;
  readonly by: Actor;
  readonly at: Date;
};

export type SkillState = SkillText & {
  /** Label names, sorted. */
  readonly labels: readonly string[];
  readonly revision: number;
  readonly createdBy: Actor;
  readonly createdAt: Date;
  readonly updatedBy: Actor;
  readonly updatedAt: Date;
};

type Props = { readonly ownerId: string };

export type NewSkill = {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly description: string;
  readonly instructions: string;
  readonly labels?: readonly string[];
  readonly actor: Actor;
  readonly now: Date;
};

export type SkillChanges = {
  readonly name?: string;
  readonly description?: string;
  readonly instructions?: string;
};

/**
 * A named block of Markdown instructions that applies to every task carrying
 * one of its labels: when an agent picks such a task up, the skill comes with
 * the brief. Fields follow the Agent Skills `SKILL.md` shape (name,
 * description, body).
 *
 * The skill holds its links to labels, by name, as tasks do; which skills a
 * label brings is a read model. Each change to the text is a new revision,
 * and a revise names the revision it was made against, so two editors never
 * silently overwrite each other. That the name is unique per person is kept by
 * the store, as for labels.
 */
export class Skill extends AggregateRoot<Props> {
  #state: SkillState;
  #newRevisions: SkillRevision[] = [];

  private constructor(id: UniqueId, props: Props, state: SkillState) {
    super(id, props);
    this.#state = state;
  }

  static create(input: NewSkill): Result<Skill, TaskError> {
    const text = parseText(input);
    if (!text.ok) return text;
    const labels = parseLabels(input.labels ?? []);
    if (!labels.ok) return labels;

    const skill = new Skill(
      UniqueId.create(input.id),
      { ownerId: input.ownerId },
      {
        ...text.value,
        labels: labels.value,
        revision: 1,
        createdBy: input.actor,
        createdAt: input.now,
        updatedBy: input.actor,
        updatedAt: input.now,
      },
    );
    skill.#newRevisions.push({
      ...text.value,
      revision: 1,
      by: input.actor,
      at: input.now,
    });
    skill.record(new SkillCreated(input.id, text.value.name, input.now));
    return ok(skill);
  }

  /** Rebuild a skill a store already holds, recording no event. */
  static restore(id: UniqueId, ownerId: string, state: SkillState): Skill {
    return new Skill(id, { ownerId }, state);
  }

  get ownerId(): string {
    return this.props.ownerId;
  }

  get name(): string {
    return this.#state.name;
  }

  get state(): SkillState {
    return this.#state;
  }

  /**
   * Change the text. `expectedRevision` is the revision the editor read: when
   * someone else revised it since, the change is refused rather than laid over
   * theirs. A change that leaves the text as it is makes no revision.
   */
  revise(
    changes: SkillChanges,
    expectedRevision: number,
    actor: Actor,
    now: Date,
  ): Result<void, TaskError> {
    if (expectedRevision !== this.#state.revision) {
      return err(staleSkill(this.#state.name, this.#state.revision));
    }
    const text = parseText({
      name: changes.name ?? this.#state.name,
      description: changes.description ?? this.#state.description,
      instructions: changes.instructions ?? this.#state.instructions,
    });
    if (!text.ok) return text;
    if (
      text.value.name === this.#state.name &&
      text.value.description === this.#state.description &&
      text.value.instructions === this.#state.instructions
    ) {
      return ok(undefined);
    }

    const revision = this.#state.revision + 1;
    this.#state = {
      ...this.#state,
      ...text.value,
      revision,
      updatedBy: actor,
      updatedAt: now,
    };
    this.#newRevisions.push({ ...text.value, revision, by: actor, at: now });
    this.record(new SkillRevised(this.id.value, revision, now));
    return ok(undefined);
  }

  /** Apply the skill to tasks carrying any of these labels too. */
  link(
    names: readonly string[],
    actor: Actor,
    now: Date,
  ): Result<void, TaskError> {
    const parsed = parseLabels(names);
    if (!parsed.ok) return parsed;
    const added = parsed.value.filter(
      (name) => !this.#state.labels.includes(name),
    );
    if (added.length === 0) return ok(undefined);
    const labels = [...this.#state.labels, ...added].sort();
    if (labels.length > MAX_SKILL_LABELS) return err(tooManyLabels());

    this.#state = { ...this.#state, labels, updatedBy: actor, updatedAt: now };
    this.record(new SkillLinked(this.id.value, added, now));
    return ok(undefined);
  }

  /** Stop applying the skill to tasks through these labels. */
  unlink(
    names: readonly string[],
    actor: Actor,
    now: Date,
  ): Result<void, TaskError> {
    const parsed = parseLabels(names);
    if (!parsed.ok) return parsed;
    const removed = parsed.value.filter((name) =>
      this.#state.labels.includes(name),
    );
    if (removed.length === 0) return ok(undefined);

    this.#state = {
      ...this.#state,
      labels: this.#state.labels.filter((name) => !removed.includes(name)),
      updatedBy: actor,
      updatedAt: now,
    };
    this.record(new SkillUnlinked(this.id.value, removed, now));
    return ok(undefined);
  }

  /** Mark the skill for removal; the store deletes it with its revisions. */
  delete(now: Date): void {
    this.record(new SkillDeleted(this.id.value, this.#state.name, now));
  }

  /** Revisions made since the skill was loaded, for the store to append. */
  pullNewRevisions(): SkillRevision[] {
    const revisions = this.#newRevisions;
    this.#newRevisions = [];
    return revisions;
  }
}

/** A skill's name as it is kept: lower case, spaces become hyphens. */
export function normaliseSkillName(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "-");
}

function parseText(raw: SkillText): Result<SkillText, TaskError> {
  const name = normaliseSkillName(raw.name);
  if (name.length > MAX_SKILL_NAME || !SKILL_NAME.test(name)) {
    return err(
      invalidSkill(
        `"${raw.name.trim()}" is not a skill name: up to ${MAX_SKILL_NAME} lower-case letters and digits in words joined by single hyphens, like frontend-conventions.`,
      ),
    );
  }
  const description = raw.description.trim();
  if (!description) {
    return err(
      invalidSkill(
        "A skill needs a description: one or two sentences saying when to use it.",
      ),
    );
  }
  if (description.length > MAX_SKILL_DESCRIPTION) {
    return err(
      invalidSkill(
        `A skill's description is at most ${MAX_SKILL_DESCRIPTION} characters; this one has ${description.length}. Say when to use it, and move the rest into the instructions.`,
      ),
    );
  }
  const instructions = raw.instructions.trim();
  if (!instructions) {
    return err(invalidSkill("A skill needs instructions, in Markdown."));
  }
  if (instructions.length > MAX_SKILL_INSTRUCTIONS) {
    return err(
      invalidSkill(
        `A skill's instructions are at most ${MAX_SKILL_INSTRUCTIONS} characters; these have ${instructions.length}. Split it into narrower skills.`,
      ),
    );
  }
  return ok({ name, description, instructions });
}

function parseLabels(
  raw: readonly string[],
): Result<readonly string[], TaskError> {
  const names: string[] = [];
  for (const candidate of raw) {
    const name = parseLabelName(candidate);
    if (!name.ok) return name;
    if (!names.includes(name.value)) names.push(name.value);
  }
  names.sort();
  if (names.length > MAX_SKILL_LABELS) return err(tooManyLabels());
  return ok(names);
}

function invalidSkill(message: string): TaskError {
  return taskError("invalid-skill", message);
}

function tooManyLabels(): TaskError {
  return invalidSkill(
    `A skill applies through at most ${MAX_SKILL_LABELS} labels. Unlink some first, or split the skill.`,
  );
}

function staleSkill(name: string, revision: number): TaskError {
  return taskError(
    "stale-skill",
    `Skill "${name}" is at revision ${revision} now: someone changed it since you read it. Read it again, and make your change on top of theirs.`,
  );
}

export function skillNotFound(reference: string): TaskError {
  return taskError(
    "skill-not-found",
    `There is no skill "${reference}". List skills to see their names.`,
  );
}

export function skillExists(name: string): TaskError {
  return taskError(
    "skill-exists",
    `There is already a skill "${name}". Revise that one, or pick another name.`,
  );
}
