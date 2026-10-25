import { AggregateRoot, err, ok, UniqueId, type Result } from "@/shared/domain";

import { describeActor, type Actor } from "./actor";
import { taskError, type TaskError } from "./errors";
import {
  QuestionnaireAnswered,
  QuestionnairePosted,
  QuestionnaireWithdrawn,
} from "./events";

export const QUESTION_TYPES = ["single", "multiple", "text"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTIONNAIRE_STATUSES = [
  "open",
  "answered",
  "withdrawn",
] as const;
export type QuestionnaireStatus = (typeof QUESTIONNAIRE_STATUSES)[number];

/** Ten keeps a round answerable on a phone in one sitting. */
export const MAX_QUESTIONS = 10;
export const MIN_SUGGESTIONS = 2;
export const MAX_SUGGESTIONS = 6;
export const MAX_QUESTION_PICTURES = 4;
export const MAX_ANSWER_PICTURES = 4;

const MAX_LENGTH = {
  title: 120,
  intro: 2000,
  prompt: 300,
  details: 4000,
  label: 120,
  description: 600,
  answer: 10_000,
  reason: 500,
} as const;

const ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,39}$/;
const LETTERS = "abcdefghijklmnopqrstuvwxyz";

/**
 * Every question takes the person's own words, so an agent's "Other" choice
 * would only duplicate the answer box under it.
 */
const OTHER = /^(other|something else)(\s*\(.*\))?[\s.:…]*$/i;

export type Suggestion = {
  readonly id: string;
  readonly label: string;
  readonly description: string | null;
  readonly recommended: boolean;
  readonly picture: string | null;
};

export type Question = {
  readonly id: string;
  readonly type: QuestionType;
  readonly prompt: string;
  readonly details: string | null;
  readonly pictures: readonly string[];
  readonly suggestions: readonly Suggestion[];
};

export type Answer = {
  readonly questionId: string;
  readonly choices: readonly string[];
  readonly text: string | null;
  readonly pictures: readonly string[];
  readonly skipped: boolean;
};

export type SuggestionDraft = {
  readonly id?: string;
  readonly label: string;
  readonly description?: string | null;
  readonly recommended?: boolean;
  readonly picture?: string | null;
};

export type QuestionDraft = {
  readonly id?: string;
  readonly type?: QuestionType;
  readonly prompt: string;
  readonly details?: string | null;
  readonly pictures?: readonly string[];
  readonly suggestions?: readonly SuggestionDraft[];
};

export type AnswerDraft = {
  readonly questionId: string;
  readonly choices?: readonly string[];
  readonly text?: string | null;
  readonly pictures?: readonly string[];
};

export type QuestionnaireState = {
  readonly status: QuestionnaireStatus;
  readonly title: string;
  readonly intro: string | null;
  readonly questions: readonly Question[];
  readonly answers: readonly Answer[] | null;
  readonly postedBy: Actor;
  readonly sessionId: string | null;
  readonly postedAt: Date;
  readonly answeredBy: Actor | null;
  readonly answeredAt: Date | null;
  readonly withdrawnAt: Date | null;
  readonly withdrawnReason: string | null;
};

type Fixed = {
  readonly ownerId: string;
  readonly taskId: string;
  readonly number: number;
};

export type NewQuestionnaire = Fixed & {
  readonly id: string;
  readonly title: string;
  readonly intro?: string | null;
  readonly questions: readonly QuestionDraft[];
  readonly postedBy: Actor;
  readonly sessionId: string | null;
  /** The pictures already on the task: a round may only show those. */
  readonly taskPictures: ReadonlySet<string>;
  readonly now: Date;
};

function invalid(message: string): TaskError {
  return taskError("invalid-questionnaire", message);
}

function optionalText(
  value: string | null | undefined,
  what: string,
  max: number,
): Result<string | null, TaskError> {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length > max) {
    return err(invalid(`${what} is longer than ${max} characters.`));
  }
  return ok(trimmed || null);
}

function requiredText(
  value: string | undefined,
  what: string,
  max: number,
): Result<string, TaskError> {
  const text = optionalText(value, what, max);
  if (!text.ok) return text;
  return text.value ? ok(text.value) : err(invalid(`${what} is empty.`));
}

function readId(
  raw: string | undefined,
  fallback: string,
  what: string,
): Result<string, TaskError> {
  const id = raw?.trim() || fallback;
  return ID.test(id)
    ? ok(id)
    : err(
        invalid(
          `${what} id "${id}" must be up to 40 letters, digits, ".", "_" or "-".`,
        ),
      );
}

class PictureUse {
  readonly #used = new Set<string>();

  constructor(private readonly onTask: ReadonlySet<string>) {}

  reserve(ids: readonly (string | null)[]): void {
    for (const id of ids) if (id) this.#used.add(id);
  }

  take(ids: readonly string[], where: string): Result<string[], TaskError> {
    const taken: string[] = [];
    for (const raw of ids) {
      const id = raw.trim().toLowerCase();
      if (!this.onTask.has(id)) {
        return err(
          invalid(
            `Picture ${raw} (${where}) is not on this task. Add it with attach_picture first and use the id it returns.`,
          ),
        );
      }
      if (this.#used.has(id)) {
        return err(
          invalid(
            `Picture ${raw} is used twice; a picture shows once a round.`,
          ),
        );
      }
      this.#used.add(id);
      taken.push(id);
    }
    return ok(taken);
  }
}

function readSuggestions(
  question: QuestionDraft,
  questionId: string,
  type: QuestionType,
  pictures: PictureUse,
): Result<Suggestion[], TaskError> {
  const drafts = (question.suggestions ?? []).filter(
    (draft) => !OTHER.test(draft.label.trim()),
  );
  if (type === "text") {
    return drafts.length === 0
      ? ok([])
      : err(
          invalid(
            `Question ${questionId} is a text question, which takes no suggestions. Make it single or multiple to offer some.`,
          ),
        );
  }
  if (drafts.length < MIN_SUGGESTIONS || drafts.length > MAX_SUGGESTIONS) {
    return err(
      invalid(
        `Question ${questionId} has ${drafts.length} suggestions; give ${MIN_SUGGESTIONS} to ${MAX_SUGGESTIONS}, or make it a text question. The person can always answer in their own words, so leave out "Other".`,
      ),
    );
  }

  const suggestions: Suggestion[] = [];
  for (const [index, draft] of drafts.entries()) {
    const id = readId(draft.id, LETTERS[index]!, "A suggestion");
    if (!id.ok) return id;
    if (suggestions.some((other) => other.id === id.value)) {
      return err(
        invalid(`Question ${questionId} has two suggestions "${id.value}".`),
      );
    }
    const label = requiredText(
      draft.label,
      `A suggestion's label in ${questionId}`,
      MAX_LENGTH.label,
    );
    if (!label.ok) return label;
    const description = optionalText(
      draft.description,
      `A suggestion's description in ${questionId}`,
      MAX_LENGTH.description,
    );
    if (!description.ok) return description;
    const picture = draft.picture
      ? pictures.take(
          [draft.picture],
          `suggestion ${id.value} of ${questionId}`,
        )
      : ok([]);
    if (!picture.ok) return picture;
    suggestions.push({
      id: id.value,
      label: label.value,
      description: description.value,
      recommended: draft.recommended ?? false,
      picture: picture.value[0] ?? null,
    });
  }
  if (
    type === "single" &&
    suggestions.filter((suggestion) => suggestion.recommended).length > 1
  ) {
    return err(
      invalid(
        `Question ${questionId} recommends more than one suggestion; a single-choice question recommends at most one.`,
      ),
    );
  }
  return ok(suggestions);
}

function readQuestions(
  drafts: readonly QuestionDraft[],
  onTask: ReadonlySet<string>,
): Result<Question[], TaskError> {
  if (drafts.length === 0 || drafts.length > MAX_QUESTIONS) {
    return err(
      invalid(
        `A round has 1 to ${MAX_QUESTIONS} questions, not ${drafts.length}. Ask only what blocks you now; another round can follow.`,
      ),
    );
  }
  const pictures = new PictureUse(onTask);
  const questions: Question[] = [];
  for (const [index, draft] of drafts.entries()) {
    const id = readId(draft.id, `q${index + 1}`, "A question");
    if (!id.ok) return id;
    if (questions.some((other) => other.id === id.value)) {
      return err(invalid(`Two questions have the id "${id.value}".`));
    }
    const prompt = requiredText(
      draft.prompt,
      `Question ${id.value}`,
      MAX_LENGTH.prompt,
    );
    if (!prompt.ok) return prompt;
    const details = optionalText(
      draft.details,
      `The details of ${id.value}`,
      MAX_LENGTH.details,
    );
    if (!details.ok) return details;
    const type =
      draft.type ?? ((draft.suggestions ?? []).length > 0 ? "single" : "text");
    if ((draft.pictures ?? []).length > MAX_QUESTION_PICTURES) {
      return err(
        invalid(
          `Question ${id.value} has more than ${MAX_QUESTION_PICTURES} pictures.`,
        ),
      );
    }
    const shown = pictures.take(draft.pictures ?? [], `question ${id.value}`);
    if (!shown.ok) return shown;
    const suggestions = readSuggestions(draft, id.value, type, pictures);
    if (!suggestions.ok) return suggestions;
    questions.push({
      id: id.value,
      type,
      prompt: prompt.value,
      details: details.value,
      pictures: shown.value,
      suggestions: suggestions.value,
    });
  }
  return ok(questions);
}

/**
 * One round of questions an agent puts to the person on a task. Its own
 * aggregate, like `Picture`: it changes none of the task's rules, and a
 * task should load without every round it ever had.
 */
export class Questionnaire extends AggregateRoot<Fixed> {
  #state: QuestionnaireState;

  private constructor(id: UniqueId, fixed: Fixed, state: QuestionnaireState) {
    super(id, fixed);
    this.#state = state;
  }

  static post(input: NewQuestionnaire): Result<Questionnaire, TaskError> {
    const title = requiredText(input.title, "The title", MAX_LENGTH.title);
    if (!title.ok) return title;
    const intro = optionalText(input.intro, "The intro", MAX_LENGTH.intro);
    if (!intro.ok) return intro;
    const questions = readQuestions(input.questions, input.taskPictures);
    if (!questions.ok) return questions;

    const questionnaire = new Questionnaire(
      UniqueId.create(input.id),
      { ownerId: input.ownerId, taskId: input.taskId, number: input.number },
      {
        status: "open",
        title: title.value,
        intro: intro.value,
        questions: questions.value,
        answers: null,
        postedBy: input.postedBy,
        sessionId: input.sessionId,
        postedAt: input.now,
        answeredBy: null,
        answeredAt: null,
        withdrawnAt: null,
        withdrawnReason: null,
      },
    );
    questionnaire.record(
      new QuestionnairePosted(input.id, input.taskId, input.number, input.now),
    );
    return ok(questionnaire);
  }

  static restore(
    id: UniqueId,
    fixed: Fixed,
    state: QuestionnaireState,
  ): Questionnaire {
    return new Questionnaire(id, fixed, state);
  }

  /**
   * Unanswered questions are allowed: warning about them is the page's job,
   * and a skipped question is an answer the agent should see.
   */
  answer(
    drafts: readonly AnswerDraft[],
    by: Actor,
    taskPictures: ReadonlySet<string>,
    now: Date,
  ): Result<void, TaskError> {
    if (by.kind === "agent") {
      return err(
        invalid(
          "Only a person answers questions. Read their answers with get_answers.",
        ),
      );
    }
    const closed = this.#refuseClosed();
    if (!closed.ok) return closed;

    const byQuestion = new Map<string, AnswerDraft>();
    for (const draft of drafts) {
      if (!this.#state.questions.some((q) => q.id === draft.questionId)) {
        return err(
          invalid(`Round ${this.number} has no question ${draft.questionId}.`),
        );
      }
      if (byQuestion.has(draft.questionId)) {
        return err(invalid(`Question ${draft.questionId} is answered twice.`));
      }
      byQuestion.set(draft.questionId, draft);
    }

    const pictures = new PictureUse(taskPictures);
    for (const question of this.#state.questions) {
      pictures.reserve(question.pictures);
      pictures.reserve(question.suggestions.map((s) => s.picture));
    }

    const answers: Answer[] = [];
    for (const [index, question] of this.#state.questions.entries()) {
      const draft = byQuestion.get(question.id);
      const where = `question ${index + 1}`;
      const choices = [...new Set(draft?.choices ?? [])];
      const unknown = choices.find(
        (choice) => !question.suggestions.some((s) => s.id === choice),
      );
      if (unknown !== undefined) {
        return err(invalid(`${where} has no suggestion "${unknown}".`));
      }
      if (question.type === "single" && choices.length > 1) {
        return err(invalid(`Pick one suggestion for ${where}.`));
      }
      const text = optionalText(
        draft?.text,
        `Your answer to ${where}`,
        MAX_LENGTH.answer,
      );
      if (!text.ok) return text;
      if ((draft?.pictures ?? []).length > MAX_ANSWER_PICTURES) {
        return err(
          invalid(`Add up to ${MAX_ANSWER_PICTURES} pictures to ${where}.`),
        );
      }
      const added = pictures.take(draft?.pictures ?? [], where);
      if (!added.ok) return added;
      answers.push({
        questionId: question.id,
        choices,
        text: text.value,
        pictures: added.value,
        skipped:
          choices.length === 0 && !text.value && added.value.length === 0,
      });
    }

    this.#state = {
      ...this.#state,
      status: "answered",
      answers,
      answeredBy: by,
      answeredAt: now,
    };
    this.record(
      new QuestionnaireAnswered(this.id.value, this.taskId, this.number, now),
    );
    return ok(undefined);
  }

  withdraw(reason: string | null, now: Date): Result<void, TaskError> {
    const closed = this.#refuseClosed();
    if (!closed.ok) return closed;
    const why = optionalText(reason, "The reason", MAX_LENGTH.reason);
    if (!why.ok) return why;
    this.#state = {
      ...this.#state,
      status: "withdrawn",
      withdrawnAt: now,
      withdrawnReason: why.value,
    };
    this.record(
      new QuestionnaireWithdrawn(this.id.value, this.taskId, this.number, now),
    );
    return ok(undefined);
  }

  #refuseClosed(): Result<void, TaskError> {
    const { status, answeredBy, answeredAt } = this.#state;
    if (status === "answered") {
      return err(
        taskError(
          "questionnaire-closed",
          `Round ${this.number} was already answered by ${describeActor(answeredBy!)} at ${answeredAt!.toISOString()}.`,
        ),
      );
    }
    if (status === "withdrawn") {
      return err(
        taskError(
          "questionnaire-closed",
          `Round ${this.number} was withdrawn, so it takes no answers.`,
        ),
      );
    }
    return ok(undefined);
  }

  get ownerId(): string {
    return this.props.ownerId;
  }

  get taskId(): string {
    return this.props.taskId;
  }

  get number(): number {
    return this.props.number;
  }

  get state(): QuestionnaireState {
    return this.#state;
  }

  get status(): QuestionnaireStatus {
    return this.#state.status;
  }

  get answeredCount(): number {
    return (this.#state.answers ?? []).filter((answer) => !answer.skipped)
      .length;
  }
}

export function questionnaireNotFound(reference: string): TaskError {
  return taskError(
    "questionnaire-not-found",
    `There is no round of questions ${reference}. get_task lists a task's rounds.`,
  );
}

export function isQuestionnaireStatus(
  value: unknown,
): value is QuestionnaireStatus {
  return QUESTIONNAIRE_STATUSES.includes(value as QuestionnaireStatus);
}
