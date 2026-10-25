import type {
  Actor,
  Answer,
  Question,
  QuestionnaireState,
  QuestionnaireStatus,
} from "@/modules/tasks/domain";

import type {
  StoredAnswer,
  StoredQuestion,
  taskQuestionnaire,
  taskQuestionnairePicture,
} from "./persistence/schema";

export type QuestionnaireRow = typeof taskQuestionnaire.$inferSelect;
export type QuestionnairePictureRow =
  typeof taskQuestionnairePicture.$inferInsert;

const actor = (kind: string, id: string, name: string): Actor => ({
  kind: kind === "agent" ? "agent" : "human",
  id,
  name,
});

function picturesWhere(
  links: readonly QuestionnairePictureRow[],
  match: (link: QuestionnairePictureRow) => boolean,
): string[] {
  return links
    .filter(match)
    .sort((a, b) => a.position - b.position)
    .map((link) => link.pictureId);
}

export function questionsOf(
  stored: readonly StoredQuestion[],
  links: readonly QuestionnairePictureRow[],
): Question[] {
  const asked = links.filter((link) => link.role === "question");
  return stored.map((question) => ({
    id: question.id,
    type: question.type,
    prompt: question.prompt,
    details: question.details,
    pictures: picturesWhere(
      asked,
      (link) => link.questionId === question.id && link.optionId == null,
    ),
    suggestions: question.options.map((option) => ({
      id: option.id,
      label: option.label,
      description: option.description,
      recommended: option.recommended,
      picture:
        asked.find(
          (link) =>
            link.questionId === question.id && link.optionId === option.id,
        )?.pictureId ?? null,
    })),
  }));
}

export function answersOf(
  stored: readonly StoredAnswer[] | null,
  links: readonly QuestionnairePictureRow[],
): Answer[] | null {
  if (!stored) return null;
  return stored.map((answer) => ({
    questionId: answer.questionId,
    choices: answer.choices,
    text: answer.text,
    skipped: answer.skipped,
    pictures: picturesWhere(
      links,
      (link) => link.role === "answer" && link.questionId === answer.questionId,
    ),
  }));
}

export function stateOf(
  row: QuestionnaireRow,
  links: readonly QuestionnairePictureRow[],
): QuestionnaireState {
  return {
    status: row.status as QuestionnaireStatus,
    title: row.title,
    intro: row.intro,
    questions: questionsOf(row.questions, links),
    answers: answersOf(row.answers, links),
    postedBy: actor(row.postedByKind, row.postedById, row.postedByName),
    sessionId: row.sessionId,
    postedAt: row.postedAt,
    answeredBy:
      row.answeredByKind && row.answeredById && row.answeredByName
        ? actor(row.answeredByKind, row.answeredById, row.answeredByName)
        : null,
    answeredAt: row.answeredAt,
    withdrawnAt: row.withdrawnAt,
    withdrawnReason: row.withdrawnReason,
  };
}

export function storedQuestions(
  questions: readonly Question[],
): StoredQuestion[] {
  return questions.map((question) => ({
    id: question.id,
    type: question.type,
    prompt: question.prompt,
    details: question.details,
    options: question.suggestions.map((suggestion) => ({
      id: suggestion.id,
      label: suggestion.label,
      description: suggestion.description,
      recommended: suggestion.recommended,
    })),
  }));
}

export function storedAnswers(
  answers: readonly Answer[] | null,
): StoredAnswer[] | null {
  return (
    answers?.map((answer) => ({
      questionId: answer.questionId,
      choices: answer.choices,
      text: answer.text,
      skipped: answer.skipped,
    })) ?? null
  );
}

export function pictureLinks(
  questionnaireId: string,
  state: QuestionnaireState,
): QuestionnairePictureRow[] {
  const links: QuestionnairePictureRow[] = [];
  for (const question of state.questions) {
    question.pictures.forEach((pictureId, position) =>
      links.push({
        questionnaireId,
        pictureId,
        questionId: question.id,
        optionId: null,
        role: "question",
        position,
      }),
    );
    for (const suggestion of question.suggestions) {
      if (!suggestion.picture) continue;
      links.push({
        questionnaireId,
        pictureId: suggestion.picture,
        questionId: question.id,
        optionId: suggestion.id,
        role: "question",
        position: 0,
      });
    }
  }
  for (const answer of state.answers ?? []) {
    answer.pictures.forEach((pictureId, position) =>
      links.push({
        questionnaireId,
        pictureId,
        questionId: answer.questionId,
        optionId: null,
        role: "answer",
        position,
      }),
    );
  }
  return links;
}
