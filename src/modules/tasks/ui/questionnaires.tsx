"use client";

import {
  CaretRight,
  ChatCircleDots,
  Check,
  MagnifyingGlassPlus,
  Paperclip,
  Warning,
  X,
} from "@phosphor-icons/react/ssr";
import {
  createContext,
  startTransition,
  useActionState,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { formatRelativeTime } from "@/modules/github-insights/ui/format";
import type {
  AnswerItem,
  PictureItem,
  QuestionItem,
  QuestionnaireItem,
} from "@/modules/tasks/application/queries/read-models";
import { MAX_ANSWER_PICTURES, PICTURE_TYPES } from "@/modules/tasks/domain";

import { Markdown } from "./markdown";
import { PictureViewer, pictureSrc } from "./pictures";
import { questionsLabel } from "./questions-chip";
import type { TaskAction } from "./task-forms";
import { EMPTY_FORM_STATE } from "./task-form-state";

type Rounds = {
  readonly rounds: readonly QuestionnaireItem[];
  readonly open: (round: number) => void;
  readonly now: Date;
};

const RoundsContext = createContext<Rounds | null>(null);

function useRounds(): Rounds {
  const rounds = useContext(RoundsContext);
  if (!rounds) throw new Error("Wrap round views in QuestionnaireProvider.");
  return rounds;
}

const DAY = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const BUTTON =
  "focus-visible:outline-pr inline-flex h-[34px] cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-[13px] text-[12.5px] font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-1 disabled:cursor-wait disabled:opacity-70";
const PRIMARY = `${BUTTON} border-ink bg-ink text-ground hover:bg-ink-soft`;
const SECONDARY = `${BUTTON} border-hairline bg-surface text-ink hover:bg-surface-sunken`;
const DANGER = `${BUTTON} border-hairline bg-surface text-issue-strong hover:bg-surface-sunken`;
const ICON =
  "text-ink-muted hover:bg-surface-sunken hover:text-ink focus-visible:outline-pr grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg focus-visible:outline-2";

/** Not login fields: these keep password managers off them. */
const NOT_A_LOGIN = {
  autoComplete: "off",
  "data-1p-ignore": true,
  "data-lpignore": "true",
  "data-bwignore": true,
  "data-form-type": "other",
} as const;

const ACCEPT = PICTURE_TYPES.join(",");

function roundUrl(round: number | null) {
  const url = new URL(window.location.href);
  if (round === null) url.searchParams.delete("round");
  else url.searchParams.set("round", String(round));
  window.history.replaceState(window.history.state, "", url);
}

export function QuestionnaireProvider({
  taskKey,
  rounds,
  answerAction,
  removePictureAction,
  picturesEnabled,
  initialRound = null,
  now,
  children,
}: {
  taskKey: string;
  rounds: readonly QuestionnaireItem[];
  answerAction: TaskAction;
  removePictureAction: TaskAction;
  picturesEnabled: boolean;
  initialRound?: number | null;
  now: string;
  children: ReactNode;
}) {
  const [shown, setShown] = useState<number | null>(() =>
    rounds.some((round) => round.round === initialRound) ? initialRound : null,
  );
  const open = useCallback((round: number) => {
    setShown(round);
    roundUrl(round);
  }, []);
  const close = useCallback(() => {
    setShown(null);
    roundUrl(null);
  }, []);
  const value = useMemo(
    () => ({ rounds, open, now: new Date(now) }),
    [rounds, open, now],
  );
  const round = rounds.find((candidate) => candidate.round === shown);

  const shownStatus = useRef(round?.status);
  useEffect(() => {
    const was = shownStatus.current;
    shownStatus.current = round?.status;
    if (was === "open" && round?.status === "answered") close();
  }, [round?.status, close]);

  return (
    <RoundsContext.Provider value={value}>
      {children}
      {round?.status === "open" ? (
        <AnswerDrawer
          key={round.id}
          taskKey={taskKey}
          round={round}
          answerAction={answerAction}
          removePictureAction={removePictureAction}
          picturesEnabled={picturesEnabled}
          now={value.now}
          onClose={close}
        />
      ) : round ? (
        <ReadOnlyDrawer
          key={round.id}
          taskKey={taskKey}
          round={round}
          now={value.now}
          onClose={close}
        />
      ) : null}
    </RoundsContext.Provider>
  );
}

export function QuestionsForYou() {
  const { rounds, open } = useRounds();
  const waiting = rounds.find((round) => round.status === "open");
  if (!waiting) return null;
  return (
    <button
      type="button"
      onClick={() => open(waiting.round)}
      className="bg-state-waiting-wash text-state-waiting border-state-waiting-line focus-visible:outline-pr inline-flex h-[22px] cursor-pointer items-center gap-1 rounded-md border px-[7px] text-[11.5px] font-medium whitespace-nowrap hover:brightness-[0.97] focus-visible:outline-2"
    >
      <ChatCircleDots aria-hidden="true" weight="bold" className="size-3" />
      {questionsLabel(waiting.questions.length, true)}
    </button>
  );
}

const STATUS_CHIP: Record<QuestionnaireItem["status"], string> = {
  open: "bg-state-waiting-wash text-state-waiting",
  answered: "bg-state-done-wash text-state-done",
  withdrawn: "bg-surface-sunken text-ink-muted",
};

function statusWord(round: QuestionnaireItem): string {
  if (round.status === "open") return "Waiting on you";
  if (round.status === "withdrawn") return "Withdrawn";
  return round.answeredAt
    ? `Answered ${DAY.format(new Date(round.answeredAt))}`
    : "Answered";
}

function subLine(round: QuestionnaireItem): string {
  if (round.status === "open") {
    return "Not answered yet. The agent continues once you submit.";
  }
  if (round.status === "withdrawn") {
    return round.withdrawnReason ?? "The agent no longer needs these answers.";
  }
  return `By ${round.answeredBy ?? "you"}, ${round.answered} of ${round.questions.length} answered`;
}

export function QuestionRounds() {
  const { rounds, open, now } = useRounds();
  if (rounds.length === 0) return null;
  const newestFirst = [...rounds].sort((a, b) => b.round - a.round);
  return (
    <section
      aria-label="Questions from the agent"
      className="flex flex-col gap-2.5"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-ink text-[13px] font-semibold">
          Questions from the agent
        </h2>
        <span className="text-ink-faint font-mono text-[12px]">
          {rounds.length === 1 ? "1 round" : `${rounds.length} rounds`}
        </span>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {newestFirst.map((round) => (
          <li key={round.id}>
            <button
              type="button"
              onClick={() => open(round.round)}
              aria-label={`Round ${round.round}, ${round.title}, ${questionsLabel(round.questions.length)}, ${statusWord(round).toLowerCase()}`}
              className="border-hairline bg-surface hover:border-ink-faint focus-visible:outline-pr flex w-full cursor-pointer flex-col gap-1.5 rounded-[10px] border px-3 py-[11px] text-left focus-visible:outline-2 focus-visible:outline-offset-1"
            >
              <span className="flex items-center gap-2">
                <span className="text-ink text-[12.5px] font-semibold">
                  Round {round.round}
                </span>
                <span
                  className={`rounded-md px-[7px] py-px text-[11px] font-medium whitespace-nowrap ${STATUS_CHIP[round.status]}`}
                >
                  {statusWord(round)}
                </span>
                <CaretRight
                  aria-hidden="true"
                  className="text-ink-faint ml-auto size-3.5"
                />
              </span>
              <span className="text-ink text-[13px] leading-snug">
                {round.title}
              </span>
              <span className="text-ink-muted text-[12px]">
                <span className="font-mono">{round.questions.length}</span>
                {round.questions.length === 1 ? " question" : " questions"},
                posted {formatRelativeTime(new Date(round.postedAt), now)}
              </span>
              <span className="text-ink-muted text-[12px] leading-snug">
                {subLine(round)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Segments({
  of,
  done,
  label,
}: {
  of: number;
  done: (index: number) => boolean;
  label: string;
}) {
  return (
    <span role="img" aria-label={label} className="flex gap-1">
      {Array.from({ length: of }, (_, index) => (
        <span
          key={index}
          className={`h-1 flex-1 rounded-sm ${done(index) ? "bg-state-done" : "bg-hairline"}`}
        />
      ))}
    </span>
  );
}

type Upload = {
  readonly key: string;
  readonly name: string;
  readonly preview: string;
  readonly id: string | null;
  readonly error: string | null;
};

type Draft = {
  readonly choices: readonly string[];
  readonly text: string;
  readonly uploads: readonly Upload[];
};

const EMPTY_DRAFT: Draft = { choices: [], text: "", uploads: [] };

function hasAnswer(draft: Draft | undefined): boolean {
  if (!draft) return false;
  return (
    draft.choices.length > 0 ||
    draft.text.trim().length > 0 ||
    draft.uploads.some((upload) => upload.id)
  );
}

const HINT: Record<QuestionItem["type"], string> = {
  single: "Pick one",
  multiple: "Pick any",
  text: "Write an answer",
};

type Viewing = {
  readonly pictures: readonly PictureItem[];
  readonly index: number;
  readonly question?: QuestionItem;
};

function AnswerDrawer({
  taskKey,
  round,
  answerAction,
  removePictureAction,
  picturesEnabled,
  now,
  onClose,
}: {
  taskKey: string;
  round: QuestionnaireItem;
  answerAction: TaskAction;
  removePictureAction: TaskAction;
  picturesEnabled: boolean;
  now: Date;
  onClose: () => void;
}) {
  const titleId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [confirm, setConfirm] = useState<"discard" | "gaps" | null>(null);
  const [viewing, setViewing] = useState<Viewing | null>(null);
  const [state, formAction, pending] = useActionState(
    answerAction,
    EMPTY_FORM_STATE,
  );

  const questions = round.questions;
  const answered = questions.filter((q) => hasAnswer(drafts[q.id]));
  const gaps = questions
    .map((question, index) => ({ question, number: index + 1 }))
    .filter(({ question }) => !hasAnswer(drafts[question.id]));
  const dirty = Object.values(drafts).some(
    (draft) => hasAnswer(draft) || draft.uploads.length > 0,
  );
  const uploading = Object.values(drafts).some((draft) =>
    draft.uploads.some((upload) => !upload.id && !upload.error),
  );

  useEffect(() => {
    heading.current?.focus();
  }, []);

  const submitted = useRef(state.saved);
  useEffect(() => {
    if (state.saved === submitted.current) return;
    submitted.current = state.saved;
    onClose();
  }, [state.saved, onClose]);

  const change = useCallback(
    (questionId: string, patch: (draft: Draft) => Draft) =>
      setDrafts((current) => ({
        ...current,
        [questionId]: patch(current[questionId] ?? EMPTY_DRAFT),
      })),
    [],
  );

  const discard = () => {
    for (const draft of Object.values(drafts)) {
      for (const upload of draft.uploads) {
        URL.revokeObjectURL(upload.preview);
        if (!upload.id) continue;
        const form = new FormData();
        form.set("task", taskKey);
        form.set("picture", upload.id);
        startTransition(() => {
          void removePictureAction(EMPTY_FORM_STATE, form);
        });
      }
    }
    setConfirm(null);
    onClose();
  };

  const requestClose = () => {
    if (pending) return;
    if (dirty) setConfirm("discard");
    else onClose();
  };

  const send = () => {
    setConfirm(null);
    const form = new FormData();
    form.set("task", taskKey);
    form.set("round", String(round.round));
    form.set(
      "answers",
      JSON.stringify(
        questions.map((question) => {
          const draft = drafts[question.id] ?? EMPTY_DRAFT;
          return {
            questionId: question.id,
            choices: draft.choices,
            text: draft.text.trim() || null,
            pictures: draft.uploads.flatMap((upload) =>
              upload.id ? [upload.id] : [],
            ),
          };
        }),
      ),
    );
    startTransition(() => formAction(form));
  };

  const submit = () => {
    if (uploading || pending) return;
    if (gaps.length > 0) setConfirm("gaps");
    else send();
  };

  const pick = (question: QuestionItem, option: string) =>
    change(question.id, (draft) => {
      if (question.type === "multiple") {
        return {
          ...draft,
          choices: draft.choices.includes(option)
            ? draft.choices.filter((id) => id !== option)
            : [...draft.choices, option],
        };
      }
      return {
        ...draft,
        choices: draft.choices[0] === option ? [] : [option],
      };
    });

  const suggestionPictures = (question: QuestionItem) =>
    question.suggestions.flatMap((suggestion) =>
      suggestion.picture ? [suggestion.picture] : [],
    );

  return (
    <>
      <section
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !confirm && !viewing) {
            event.stopPropagation();
            requestClose();
          }
        }}
        className="border-hairline bg-surface fixed inset-0 z-50 flex flex-col shadow-[0_18px_48px_rgba(22,22,26,0.16)] sm:top-14 sm:left-auto sm:z-30 sm:w-[520px] sm:border-l"
      >
        <header className="border-hairline-soft flex flex-col gap-3 border-b px-5 pt-4 pb-3.5">
          <div className="flex items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-state-waiting inline-flex items-center gap-1.5 text-[12px] font-medium">
                <ChatCircleDots aria-hidden="true" className="size-3.5" />
                Questions from{" "}
                <span className="font-mono">{round.postedBy}</span>
              </span>
              <h2
                id={titleId}
                ref={heading}
                tabIndex={-1}
                className="text-ink text-[17px] leading-snug font-semibold tracking-tight outline-none"
              >
                Round {round.round}: {round.title}
              </h2>
              <span className="text-ink-muted text-[12px]">
                Posted {formatRelativeTime(new Date(round.postedAt), now)}
                {round.session ? (
                  <>
                    {" in session "}
                    <span className="font-mono">{round.session}</span>
                  </>
                ) : null}
                {" on "}
                <span className="font-mono">{taskKey}</span>
              </span>
              {round.intro ? (
                <Markdown className="text-ink-soft mt-1 text-[13px] leading-relaxed">
                  {round.intro}
                </Markdown>
              ) : null}
            </div>
            <button
              type="button"
              aria-label="Close questions"
              onClick={requestClose}
              className={ICON}
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-ink-muted shrink-0 text-[12px]">
              <span className="text-ink font-mono">{answered.length}</span>
              {" of "}
              <span className="font-mono">{questions.length}</span> answered
            </span>
            <span className="flex-1">
              <Segments
                of={questions.length}
                done={(index) => hasAnswer(drafts[questions[index]!.id])}
                label={`${answered.length} of ${questions.length} answered`}
              />
            </span>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-5 py-4">
          {questions.map((question, index) => (
            <QuestionCard
              key={question.id}
              number={index + 1}
              question={question}
              draft={drafts[question.id] ?? EMPTY_DRAFT}
              taskKey={taskKey}
              picturesEnabled={picturesEnabled}
              onPick={(option) => pick(question, option)}
              onText={(text) =>
                change(question.id, (draft) => ({ ...draft, text }))
              }
              onUploads={(patch) =>
                change(question.id, (draft) => ({
                  ...draft,
                  uploads: patch(draft.uploads),
                }))
              }
              onZoomQuestion={(at) =>
                setViewing({ pictures: question.pictures, index: at })
              }
              onZoomSuggestion={(picture) =>
                setViewing({
                  pictures: suggestionPictures(question),
                  index: suggestionPictures(question).findIndex(
                    (candidate) => candidate.id === picture.id,
                  ),
                  question,
                })
              }
            />
          ))}
        </div>

        <footer className="border-hairline-soft flex flex-col gap-2 border-t px-5 py-3">
          {state.error ? (
            <p
              role="alert"
              className="bg-issue-wash text-issue-strong rounded-lg px-3 py-2 text-[12px]"
            >
              {state.error}
            </p>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <span className="text-ink-muted text-[12px]">
              {uploading
                ? "Waiting for your pictures to finish uploading."
                : "The agent continues once you submit."}
            </span>
            <button
              type="button"
              onClick={submit}
              disabled={pending || uploading}
              className={PRIMARY}
            >
              {pending ? "Submitting" : "Submit answers"}
            </button>
          </div>
        </footer>
      </section>

      {confirm === "discard" ? (
        <ConfirmDialog
          title="Discard your answers?"
          body={`You answered ${answered.length} of ${questions.length} ${questions.length === 1 ? "question" : "questions"} and have not submitted. Closing now throws those answers away.`}
          confirmLabel="Discard answers"
          confirmClass={DANGER}
          onConfirm={discard}
          onKeep={() => setConfirm(null)}
        />
      ) : confirm === "gaps" ? (
        <ConfirmDialog
          title={`${gaps.length === 1 ? "1 question has" : `${gaps.length} questions have`} no answer. Submit anyway?`}
          body="The agent sees them as skipped and may ask again in a new round."
          confirmLabel="Submit anyway"
          confirmClass={PRIMARY}
          onConfirm={send}
          onKeep={() => setConfirm(null)}
        >
          <ul className="border-hairline-soft m-0 flex list-none flex-col gap-1.5 border-t p-0 pt-3">
            {gaps.map(({ question, number }) => (
              <li
                key={question.id}
                className="text-ink flex gap-2 text-[12.5px] leading-snug"
              >
                <span className="text-ink-faint w-4 shrink-0 font-mono">
                  {number}
                </span>
                <span>{question.prompt}</span>
              </li>
            ))}
          </ul>
        </ConfirmDialog>
      ) : null}

      <PictureViewer
        pictures={viewing?.pictures ?? []}
        index={viewing ? viewing.index : null}
        onIndex={(index) =>
          setViewing((current) =>
            current && index !== null ? { ...current, index } : null,
          )
        }
        taskKey={taskKey}
        caption={
          viewing?.question
            ? (index) => {
                const suggestion = suggestionAt(viewing.question!, index);
                return `${suggestion?.label ?? ""}. Attached by ${round.postedBy}`;
              }
            : undefined
        }
        choose={
          viewing?.question
            ? {
                label: (index) =>
                  `Choose ${suggestionAt(viewing.question!, index)?.id.toUpperCase() ?? ""}`,
                onChoose: (index) => {
                  const question = viewing.question!;
                  const suggestion = suggestionAt(question, index);
                  if (!suggestion) return;
                  change(question.id, (draft) => ({
                    ...draft,
                    choices:
                      question.type === "multiple"
                        ? draft.choices.includes(suggestion.id)
                          ? draft.choices
                          : [...draft.choices, suggestion.id]
                        : [suggestion.id],
                  }));
                },
              }
            : undefined
        }
      />
    </>
  );
}

function suggestionAt(question: QuestionItem, index: number) {
  return question.suggestions.filter((suggestion) => suggestion.picture)[index];
}

function QuestionCard({
  number,
  question,
  draft,
  taskKey,
  picturesEnabled,
  onPick,
  onText,
  onUploads,
  onZoomQuestion,
  onZoomSuggestion,
}: {
  number: number;
  question: QuestionItem;
  draft: Draft;
  taskKey: string;
  picturesEnabled: boolean;
  onPick: (option: string) => void;
  onText: (text: string) => void;
  onUploads: (patch: (uploads: readonly Upload[]) => readonly Upload[]) => void;
  onZoomQuestion: (index: number) => void;
  onZoomSuggestion: (picture: PictureItem) => void;
}) {
  const fieldId = useId();
  const answered = hasAnswer(draft);
  const withPictures = question.suggestions.some(
    (suggestion) => suggestion.picture,
  );

  return (
    <article
      aria-label={`Question ${number}`}
      className="border-hairline bg-surface flex flex-col gap-3 rounded-xl border p-3.5"
    >
      <div className="flex items-start gap-2.5">
        <span
          className={`grid size-6 shrink-0 place-items-center rounded-[7px] font-mono text-[12px] font-semibold ${
            answered
              ? "bg-state-done-wash text-state-done"
              : "bg-surface-sunken text-ink-soft"
          }`}
        >
          {answered ? (
            <Check aria-label="Answered" weight="bold" className="size-3.5" />
          ) : (
            number
          )}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-ink-muted text-[11.5px] font-medium">
            {HINT[question.type]}
          </span>
          <h3 className="text-ink text-[14px] leading-snug font-semibold">
            {question.prompt}
          </h3>
          {question.details ? (
            <Markdown className="text-ink-muted text-[12.5px] leading-relaxed">
              {question.details}
            </Markdown>
          ) : null}
        </div>
      </div>

      {question.pictures.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {question.pictures.map((picture, index) => (
            <ZoomTile
              key={picture.id}
              picture={picture}
              onZoom={() => onZoomQuestion(index)}
            />
          ))}
        </div>
      ) : null}

      {question.type === "text" ? null : withPictures ? (
        <div className="grid grid-cols-2 gap-2.5">
          {question.suggestions.map((suggestion) => (
            <div key={suggestion.id} className="flex flex-col gap-1.5">
              {suggestion.picture ? (
                <ZoomTile
                  picture={suggestion.picture}
                  picked={draft.choices.includes(suggestion.id)}
                  onZoom={() => onZoomSuggestion(suggestion.picture!)}
                />
              ) : null}
              <Option
                question={question}
                suggestion={suggestion}
                picked={draft.choices.includes(suggestion.id)}
                onPick={() => onPick(suggestion.id)}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {question.suggestions.map((suggestion) => (
            <Option
              key={suggestion.id}
              question={question}
              suggestion={suggestion}
              picked={draft.choices.includes(suggestion.id)}
              onPick={() => onPick(suggestion.id)}
            />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <label
            htmlFor={fieldId}
            className="text-ink-soft text-[12px] font-medium"
          >
            Your answer
          </label>
          <span className="text-ink-faint text-[11px]">Markdown</span>
        </div>
        <textarea
          id={fieldId}
          rows={question.type === "text" ? 4 : 2}
          value={draft.text}
          onChange={(event) => onText(event.target.value)}
          placeholder={
            question.type === "text"
              ? "Write as much or as little as you like"
              : "Optional. A note, or an answer none of these cover"
          }
          {...NOT_A_LOGIN}
          className="border-hairline bg-surface text-ink placeholder:text-ink-faint focus:outline-pr w-full resize-y rounded-lg border px-[11px] py-2 text-[13px] leading-[1.45] focus:outline-2 focus:outline-offset-1"
        />
        {picturesEnabled ? (
          <AnswerPictures
            taskKey={taskKey}
            uploads={draft.uploads}
            onUploads={onUploads}
          />
        ) : null}
      </div>
    </article>
  );
}

function Option({
  question,
  suggestion,
  picked,
  onPick,
}: {
  question: QuestionItem;
  suggestion: QuestionItem["suggestions"][number];
  picked: boolean;
  onPick: () => void;
}) {
  const square = question.type === "multiple";
  return (
    <button
      type="button"
      aria-pressed={picked}
      onClick={onPick}
      className={`focus-visible:outline-pr flex w-full cursor-pointer items-start gap-2.5 rounded-[10px] border px-3 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-1 ${
        picked
          ? "border-ink bg-surface-raised shadow-[inset_0_0_0_0.5px_var(--color-ink)]"
          : "border-hairline bg-surface hover:border-ink-faint"
      }`}
    >
      <span
        aria-hidden="true"
        className={`mt-px grid size-4 shrink-0 place-items-center border-[1.5px] ${
          square ? "rounded-[4px]" : "rounded-full"
        } ${picked ? "border-ink" : "border-ink-faint"} ${
          picked && square ? "bg-ink text-ground" : ""
        }`}
      >
        {picked ? (
          square ? (
            <Check weight="bold" className="size-2.5" />
          ) : (
            <span className="bg-ink size-2 rounded-full" />
          )
        ) : null}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-ink text-[13px] leading-snug font-medium">
          {suggestion.label}
        </span>
        {suggestion.description ? (
          <span className="text-ink-muted text-[12px] leading-snug">
            {suggestion.description}
          </span>
        ) : null}
      </span>
      {suggestion.recommended ? (
        <span className="bg-state-ready-wash text-state-ready shrink-0 rounded-md px-[7px] py-px text-[11px] font-medium">
          Recommended
        </span>
      ) : null}
    </button>
  );
}

function ZoomTile({
  picture,
  picked = false,
  onZoom,
}: {
  picture: PictureItem;
  picked?: boolean;
  onZoom: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onZoom}
      aria-label={`Open ${picture.name} large`}
      className={`bg-surface-sunken focus-visible:outline-pr relative block aspect-[4/3] w-full cursor-zoom-in overflow-hidden rounded-lg border focus-visible:outline-2 focus-visible:outline-offset-2 ${
        picked ? "border-ink ring-ink ring-1" : "border-hairline"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={pictureSrc(picture)}
        alt={picture.name}
        className="block size-full object-cover object-top-left"
      />
      <span className="bg-surface/90 text-ink absolute right-1.5 bottom-1.5 grid size-6 place-items-center rounded-md">
        <MagnifyingGlassPlus aria-hidden="true" className="size-3.5" />
      </span>
    </button>
  );
}

function AnswerPictures({
  taskKey,
  uploads,
  onUploads,
}: {
  taskKey: string;
  uploads: readonly Upload[];
  onUploads: (patch: (uploads: readonly Upload[]) => readonly Upload[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const update = (key: string, patch: Partial<Upload>) =>
    onUploads((current) =>
      current.map((upload) =>
        upload.key === key ? { ...upload, ...patch } : upload,
      ),
    );

  const add = (files: readonly File[]) => {
    const room = MAX_ANSWER_PICTURES - uploads.length;
    for (const file of files.slice(0, Math.max(0, room))) {
      const key = crypto.randomUUID();
      const name = file.name || "pasted picture";
      onUploads((current) => [
        ...current,
        {
          key,
          name,
          preview: URL.createObjectURL(file),
          id: null,
          error: null,
        },
      ]);
      const request = new XMLHttpRequest();
      request.open(
        "POST",
        `/api/tasks/${encodeURIComponent(taskKey)}/pictures?name=${encodeURIComponent(name)}`,
      );
      request.setRequestHeader(
        "content-type",
        file.type || "application/octet-stream",
      );
      request.onload = () => {
        if (request.status === 201) {
          const { id } = JSON.parse(request.responseText) as { id: string };
          update(key, { id });
          return;
        }
        let message = "The picture could not be added. Try again.";
        try {
          message =
            (JSON.parse(request.responseText) as { error?: string }).error ??
            message;
        } catch {
          // Not JSON: a proxy or host error page. The default says enough.
        }
        update(key, { error: message });
      };
      request.onerror = () =>
        update(key, {
          error: "The connection dropped before the picture arrived.",
        });
      request.send(file);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {uploads.map((upload) => (
        <span
          key={upload.key}
          className={`border-hairline bg-surface-sunken inline-flex max-w-full items-center gap-2 rounded-lg border py-1 pr-1 pl-1 ${
            upload.error ? "border-issue" : ""
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={upload.preview}
            alt=""
            className={`size-7 rounded-md object-cover ${upload.id ? "" : "opacity-60"}`}
          />
          <span className="text-ink-soft max-w-[160px] truncate font-mono text-[11.5px]">
            {upload.error ?? upload.name}
          </span>
          <button
            type="button"
            aria-label={`Remove ${upload.name}`}
            onClick={() => {
              URL.revokeObjectURL(upload.preview);
              onUploads((current) =>
                current.filter((candidate) => candidate.key !== upload.key),
              );
            }}
            className={`${ICON} size-6`}
          >
            <X aria-hidden="true" className="size-3" />
          </button>
        </span>
      ))}
      {uploads.length < MAX_ANSWER_PICTURES ? (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="text-ink-soft hover:bg-surface-sunken hover:text-ink focus-visible:outline-pr inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-[12px] font-medium focus-visible:outline-2"
        >
          <Paperclip aria-hidden="true" className="size-3.5" />
          Add picture
        </button>
      ) : null}
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(event) => {
          add([...(event.target.files ?? [])]);
          event.target.value = "";
        }}
      />
    </div>
  );
}

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  confirmClass,
  onConfirm,
  onKeep,
  children,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  confirmClass: string;
  onConfirm: () => void;
  onKeep: () => void;
  children?: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      role="alertdialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onKeep();
      }}
      className="border-hairline bg-surface text-ink m-auto w-[calc(100%-24px)] max-w-[400px] rounded-[14px] border p-[18px] shadow-[0_18px_48px_rgba(22,22,26,0.16)] backdrop:bg-[rgba(22,22,18,0.42)] max-sm:mb-3"
    >
      <div className="flex flex-col gap-3.5">
        <div className="flex items-start gap-3">
          <span className="bg-state-paused-wash text-state-paused grid size-8 shrink-0 place-items-center rounded-lg">
            <Warning aria-hidden="true" className="size-4" />
          </span>
          <div className="flex flex-col gap-1">
            <h2
              id={titleId}
              className="text-ink text-[14.5px] leading-snug font-semibold"
            >
              {title}
            </h2>
            <p className="text-ink-muted text-[12.5px] leading-relaxed">
              {body}
            </p>
          </div>
        </div>
        {children}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onKeep}
            autoFocus
            className={SECONDARY}
          >
            Keep answering
          </button>
          <button type="button" onClick={onConfirm} className={confirmClass}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

function answerText(
  question: QuestionItem,
  answer: AnswerItem | undefined,
): string | null {
  if (!answer || answer.skipped) return null;
  const labels = answer.choices.map(
    (id) =>
      question.suggestions.find((suggestion) => suggestion.id === id)?.label ??
      id,
  );
  return labels.join(", ") || null;
}

function ReadOnlyDrawer({
  taskKey,
  round,
  now,
  onClose,
}: {
  taskKey: string;
  round: QuestionnaireItem;
  now: Date;
  onClose: () => void;
}) {
  const titleId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const [viewing, setViewing] = useState<Viewing | null>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);

  const meta =
    round.status === "withdrawn"
      ? `By ${round.postedBy}${round.withdrawnAt ? ` on ${DAY.format(new Date(round.withdrawnAt))}` : ""}${round.withdrawnReason ? `: ${round.withdrawnReason}` : ""}`
      : `By ${round.answeredBy ?? "you"}${round.answeredAt ? `, ${formatRelativeTime(new Date(round.answeredAt), now)}` : ""}`;

  return (
    <>
      <section
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !viewing) {
            event.stopPropagation();
            onClose();
          }
        }}
        className="border-hairline bg-surface fixed inset-0 z-50 flex flex-col shadow-[0_18px_48px_rgba(22,22,26,0.16)] sm:top-14 sm:left-auto sm:z-30 sm:w-[520px] sm:border-l"
      >
        <header className="border-hairline-soft flex items-start gap-3 border-b px-5 pt-4 pb-3.5">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-ink-muted text-[12px]">
              Questions from <span className="font-mono">{round.postedBy}</span>
            </span>
            <h2
              id={titleId}
              ref={heading}
              tabIndex={-1}
              className="text-ink text-[17px] leading-snug font-semibold tracking-tight outline-none"
            >
              Round {round.round}: {round.title}
            </h2>
            <span className="text-ink-muted flex flex-wrap items-center gap-2 text-[12px]">
              <span
                className={`rounded-md px-[7px] py-px text-[11px] font-medium ${STATUS_CHIP[round.status]}`}
              >
                {round.status === "withdrawn" ? "Withdrawn" : "Answered"}
              </span>
              {meta}
            </span>
          </div>
          <button
            type="button"
            aria-label="Close questions"
            onClick={onClose}
            className={ICON}
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </header>
        <ol className="m-0 flex min-h-0 flex-1 list-none flex-col gap-0 overflow-y-auto px-5 py-2">
          {round.questions.map((question, index) => {
            const answer = round.answers?.find(
              (candidate) => candidate.questionId === question.id,
            );
            const picked = answerText(question, answer);
            return (
              <li
                key={question.id}
                className="border-hairline-soft flex flex-col gap-1.5 border-b py-3.5 last:border-b-0"
              >
                <span className="text-ink-soft flex gap-2 text-[12.5px] leading-snug">
                  <span className="text-ink-faint w-4 shrink-0 font-mono">
                    {index + 1}
                  </span>
                  {question.prompt}
                </span>
                <div className="flex flex-col gap-1.5 pl-6">
                  {picked ? (
                    <span className="text-ink text-[13px] font-medium">
                      {picked}
                    </span>
                  ) : null}
                  {answer?.text ? (
                    <Markdown className="text-ink text-[13px] leading-relaxed">
                      {answer.text}
                    </Markdown>
                  ) : null}
                  {answer && answer.pictures.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {answer.pictures.map((picture, at) => (
                        <button
                          key={picture.id}
                          type="button"
                          onClick={() =>
                            setViewing({ pictures: answer.pictures, index: at })
                          }
                          aria-label={`Open ${picture.name} large`}
                          className="border-hairline bg-surface-sunken focus-visible:outline-pr size-14 cursor-zoom-in overflow-hidden rounded-md border focus-visible:outline-2"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={pictureSrc(picture)}
                            alt={picture.name}
                            className="size-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {!picked && !answer?.text && !answer?.pictures.length ? (
                    <span className="text-ink-muted text-[12.5px]">
                      {round.status === "withdrawn"
                        ? "Not answered. Withdrawn before you replied."
                        : "Skipped"}
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </section>
      <PictureViewer
        pictures={viewing?.pictures ?? []}
        index={viewing ? viewing.index : null}
        onIndex={(index) =>
          setViewing((current) =>
            current && index !== null ? { ...current, index } : null,
          )
        }
        taskKey={taskKey}
      />
    </>
  );
}
