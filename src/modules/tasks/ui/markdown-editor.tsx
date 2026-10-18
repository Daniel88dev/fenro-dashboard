"use client";

import {
  Code,
  LinkSimple,
  ListBullets,
  ListChecks,
  ListNumbers,
  Quotes,
  TextB,
  TextH,
  TextItalic,
  TextStrikethrough,
} from "@phosphor-icons/react/ssr";
import type { Icon } from "@phosphor-icons/react";
import {
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";

import { Markdown } from "./markdown";
import {
  continueList,
  format,
  SHORTCUTS,
  type FormatAction,
  type TextEdit,
} from "./markdown-editing";

type Tool = {
  readonly action: FormatAction;
  readonly label: string;
  readonly icon: Icon;
  readonly shortcut?: string;
};

const GROUPS: readonly (readonly Tool[])[] = [
  [
    { action: "heading", label: "Heading", icon: TextH },
    { action: "bold", label: "Bold", icon: TextB, shortcut: "B" },
    { action: "italic", label: "Italic", icon: TextItalic, shortcut: "I" },
    {
      action: "strikethrough",
      label: "Strikethrough",
      icon: TextStrikethrough,
    },
  ],
  [
    { action: "quote", label: "Quote", icon: Quotes },
    { action: "code", label: "Code", icon: Code, shortcut: "E" },
    { action: "link", label: "Link", icon: LinkSimple, shortcut: "K" },
  ],
  [
    { action: "bulletList", label: "Bulleted list", icon: ListBullets },
    { action: "numberedList", label: "Numbered list", icon: ListNumbers },
    { action: "taskList", label: "Task list", icon: ListChecks },
  ],
];

const NOT_A_LOGIN = {
  autoComplete: "off",
  "data-1p-ignore": true,
  "data-lpignore": "true",
  "data-bwignore": true,
  "data-form-type": "other",
} as const;

const noSubscription = () => () => {};

function useModifierKey(): string {
  return useSyncExternalStore(
    noSubscription,
    () => (/Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl+"),
    () => "⌘",
  );
}

function applyEdit(textarea: HTMLTextAreaElement, edit: TextEdit) {
  textarea.focus();
  textarea.setSelectionRange(edit.start, edit.end);
  // execCommand is deprecated but still the only way to keep a scripted edit
  // in the browser's undo history, so Cmd+Z undoes a toolbar click.
  const inserted =
    typeof document.execCommand === "function" &&
    (edit.text
      ? document.execCommand("insertText", false, edit.text)
      : edit.start === edit.end || document.execCommand("delete"));
  if (!inserted) {
    textarea.setRangeText(edit.text, edit.start, edit.end);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }
  textarea.setSelectionRange(edit.selectionStart, edit.selectionEnd);
}

export function MarkdownEditor({
  id,
  name,
  label,
  defaultValue,
  placeholder,
  rows,
  className = "",
}: {
  id: string;
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  rows: number;
  className?: string;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState<{
    text: string;
    height: number;
  } | null>(null);
  const mod = useModifierKey();

  function run(action: FormatAction) {
    const field = textarea.current;
    if (!field) return;
    const { value, selectionStart: start, selectionEnd: end } = field;
    applyEdit(field, format(action, { value, start, end }));
  }

  function show(previewing: boolean) {
    const field = textarea.current;
    if (!field) return;
    setPreview(
      previewing
        ? { text: field.value, height: field.offsetHeight || 0 }
        : null,
    );
    if (!previewing) requestAnimationFrame(() => field.focus());
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const field = event.currentTarget;
    const { value, selectionStart: start, selectionEnd: end } = field;
    if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey) {
      const action = SHORTCUTS[event.key.toLowerCase()];
      if (!action) return;
      event.preventDefault();
      applyEdit(field, format(action, { value, start, end }));
      return;
    }
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.altKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }
    const edit = continueList({ value, start, end });
    if (!edit) return;
    event.preventDefault();
    applyEdit(field, edit);
  }

  return (
    <div className="border-hairline bg-surface has-[textarea:focus-visible]:outline-pr overflow-hidden rounded-lg border has-[textarea:focus-visible]:outline-2 has-[textarea:focus-visible]:outline-offset-1">
      <div className="border-hairline-soft bg-surface-raised flex min-h-9 flex-wrap items-stretch justify-between border-b sm:flex-nowrap sm:gap-1.5 sm:pr-1.5">
        <div
          role="group"
          aria-label={`${label} view`}
          className="flex min-h-9 shrink-0"
        >
          {(
            [
              [false, "Write"],
              [true, "Preview"],
            ] as const
          ).map(([value, text]) => {
            const pressed = (preview !== null) === value;
            return (
              <button
                key={text}
                type="button"
                aria-pressed={pressed}
                onClick={() => show(value)}
                className={`focus-visible:outline-pr -mb-px cursor-pointer border-x border-b px-3 text-[12.5px] first:border-l-0 focus-visible:outline-2 focus-visible:-outline-offset-2 ${
                  pressed
                    ? "border-x-hairline-soft border-b-surface bg-surface text-ink font-medium"
                    : "text-ink-muted hover:text-ink border-transparent"
                }`}
              >
                {text}
              </button>
            );
          })}
        </div>
        <div
          role="toolbar"
          aria-label="Formatting"
          className="border-hairline-soft bg-surface flex w-full min-w-0 [scrollbar-width:none] items-center gap-px overflow-x-auto border-t px-1.5 py-[3px] sm:w-auto sm:border-t-0 sm:bg-transparent sm:px-0"
        >
          {GROUPS.map((group, index) => (
            <div key={index} className="flex shrink-0 items-center gap-px">
              {index > 0 ? (
                <span
                  aria-hidden="true"
                  className="bg-hairline mx-1 h-4 w-px"
                />
              ) : null}
              {group.map((tool) => (
                <button
                  key={tool.action}
                  type="button"
                  aria-label={tool.label}
                  title={
                    tool.shortcut
                      ? `${tool.label} (${mod}${tool.shortcut})`
                      : tool.label
                  }
                  disabled={preview !== null}
                  // Keeps focus, and the phone keyboard, on the text.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => run(tool.action)}
                  className="text-ink-muted hover:bg-neutral-wash hover:text-ink focus-visible:outline-pr grid size-7 shrink-0 cursor-pointer place-items-center rounded-md focus-visible:outline-2 focus-visible:-outline-offset-2 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <tool.icon aria-hidden="true" className="size-4" />
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
      <textarea
        ref={textarea}
        id={id}
        name={name}
        rows={rows}
        hidden={preview !== null}
        defaultValue={defaultValue}
        placeholder={placeholder}
        onKeyDown={onKeyDown}
        className={`bg-surface text-ink placeholder:text-ink-faint block field-sizing-content w-full resize-y px-3 py-2.5 font-mono text-[12.5px] leading-relaxed outline-none ${className}`}
        {...NOT_A_LOGIN}
      />
      {preview ? (
        <div
          style={{ minHeight: preview.height || undefined }}
          className="px-3.5 py-2.5"
        >
          {preview.text.trim() ? (
            <Markdown className="text-ink text-[14px] leading-relaxed">
              {preview.text}
            </Markdown>
          ) : (
            <p className="text-ink-muted text-[13px]">
              Nothing to preview yet.
            </p>
          )}
        </div>
      ) : null}
      <div className="border-hairline-soft bg-surface-raised text-ink-faint flex justify-between gap-3 border-t px-3 py-1 text-[11.5px]">
        <span>Markdown, rendered as on the task page</span>
        <span className="hidden gap-1 font-mono text-[10.5px] sm:flex">
          {["B", "I", "K"].map((key) => (
            <kbd
              key={key}
              className="border-hairline bg-surface text-ink-muted rounded border px-1"
            >
              {mod}
              {key}
            </kbd>
          ))}
        </span>
      </div>
    </div>
  );
}
