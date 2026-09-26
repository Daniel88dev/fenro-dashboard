"use client";

import {
  ArrowSquareOut,
  CaretLeft,
  CaretRight,
  ImageSquare,
  Trash,
  UploadSimple,
  X,
} from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useActionState,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type DragEvent,
  type ReactNode,
} from "react";

import type { PictureItem } from "@/modules/tasks/application/queries/read-models";
import { PICTURE_TYPES } from "@/modules/tasks/domain";

import type { TaskAction } from "./task-forms";
import { EMPTY_FORM_STATE } from "./task-form-state";

/** Where a picture loads from: the app checks the owner, then redirects. */
export function pictureSrc(picture: Pick<PictureItem, "id">): string {
  return `/api/pictures/${picture.id}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** "claude-code, session 3" or "Daniel". */
export function addedByLine(picture: PictureItem): string {
  return picture.session
    ? `${picture.addedBy}, session ${picture.session}`
    : picture.addedBy;
}

const ACCEPT = PICTURE_TYPES.join(",");

const SECONDARY =
  "border-hairline bg-surface text-ink hover:bg-surface-sunken focus-visible:outline-pr inline-flex h-[30px] cursor-pointer items-center gap-1.5 rounded-lg border px-[10px] text-[12px] font-medium whitespace-nowrap focus-visible:outline-2";
const TILE_FRAME =
  "border-hairline bg-surface-sunken relative block aspect-[4/3] w-full overflow-hidden rounded-lg border";
const TILE_BUTTON =
  "group focus-visible:outline-pr flex min-w-0 cursor-zoom-in flex-col gap-1.5 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2";

// --- Uploading -----------------------------------------------------------------

type Upload = {
  readonly id: string;
  readonly name: string;
  /** A local preview while the bytes travel. */
  readonly preview: string;
  readonly progress: number;
  readonly error: string | null;
};

/**
 * Pasting a picture adds it to the task on screen. When a task dialog opens
 * over a task page both are mounted, and only the one on top should take it.
 */
const pasteTargets: symbol[] = [];

/**
 * Sends files to the task one request each, with progress, and refreshes the
 * page as each lands. What failed stays on screen with the reason until it
 * is dismissed.
 */
function usePictureUploads(taskKey: string) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [uploads, setUploads] = useState<readonly Upload[]>([]);

  const change = useCallback(
    (id: string, patch: Partial<Upload>) =>
      setUploads((current) =>
        current.map((upload) =>
          upload.id === id ? { ...upload, ...patch } : upload,
        ),
      ),
    [],
  );

  const dismiss = useCallback((id: string) => {
    setUploads((current) => {
      const gone = current.find((upload) => upload.id === id);
      if (gone) URL.revokeObjectURL(gone.preview);
      return current.filter((upload) => upload.id !== id);
    });
  }, []);

  const add = useCallback(
    (files: readonly File[]) => {
      for (const file of files) {
        const id = crypto.randomUUID();
        setUploads((current) => [
          ...current,
          {
            id,
            name: file.name || "pasted picture",
            preview: URL.createObjectURL(file),
            progress: 0,
            error: null,
          },
        ]);

        const request = new XMLHttpRequest();
        request.open(
          "POST",
          `/api/tasks/${encodeURIComponent(taskKey)}/pictures?name=${encodeURIComponent(file.name || "pasted picture")}`,
        );
        request.setRequestHeader(
          "content-type",
          file.type || "application/octet-stream",
        );
        request.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            change(id, { progress: event.loaded / event.total });
          }
        };
        request.onload = () => {
          if (request.status === 201) {
            startTransition(() => router.refresh());
            // Keep the preview until the refreshed list shows the real one.
            setTimeout(() => dismiss(id), 1500);
            change(id, { progress: 1 });
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
          change(id, { error: message });
        };
        request.onerror = () =>
          change(id, {
            error:
              "The connection dropped before the picture arrived. Try again.",
          });
        request.send(file);
      }
    },
    [taskKey, change, dismiss, router],
  );

  // Pasting a picture anywhere on the page adds it.
  useEffect(() => {
    const me = Symbol(taskKey);
    pasteTargets.push(me);
    const onPaste = (event: ClipboardEvent) => {
      if (pasteTargets.at(-1) !== me) return;
      const files = [...(event.clipboardData?.files ?? [])].filter((file) =>
        file.type.startsWith("image/"),
      );
      if (files.length === 0) return;
      event.preventDefault();
      add(files);
    };
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("paste", onPaste);
      pasteTargets.splice(pasteTargets.indexOf(me), 1);
    };
  }, [add, taskKey]);

  return { uploads, add, dismiss };
}

/** Dropping files anywhere on the element adds them. */
function useDropZone(add: (files: readonly File[]) => void) {
  const [over, setOver] = useState(false);
  const carriesFiles = (event: DragEvent) =>
    event.dataTransfer.types.includes("Files");
  return {
    over,
    handlers: {
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (!carriesFiles(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setOver(true);
      },
      onDragLeave: (event: DragEvent<HTMLElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOver(false);
        }
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        if (!carriesFiles(event)) return;
        event.preventDefault();
        setOver(false);
        add([...event.dataTransfer.files]);
      },
    },
  };
}

function FilePicker({
  onFiles,
  children,
  className,
}: {
  onFiles: (files: readonly File[]) => void;
  children: ReactNode;
  className: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => input.current?.click()}
      >
        {children}
      </button>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(event) => {
          onFiles([...(event.target.files ?? [])]);
          event.target.value = "";
        }}
      />
    </>
  );
}

// --- Tiles ---------------------------------------------------------------------

function PictureTile({
  picture,
  onOpen,
  meta = true,
}: {
  picture: PictureItem;
  onOpen: () => void;
  meta?: boolean;
}) {
  return (
    <button
      type="button"
      className={TILE_BUTTON}
      onClick={onOpen}
      aria-label={`Open ${picture.name}`}
    >
      <span
        className={`${TILE_FRAME} group-hover:border-ink-faint transition-colors`}
      >
        {/* Served through the app's own route, which next/image cannot fetch as the viewer. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={pictureSrc(picture)}
          alt=""
          loading="lazy"
          className="block size-full object-cover object-top"
        />
      </span>
      <span className="text-ink font-mono text-[12px] leading-snug break-all">
        {picture.name}
      </span>
      {meta ? (
        <span className="text-ink-muted text-[11.5px]">
          {`${addedByLine(picture)} · ${formatBytes(picture.bytes)}`}
        </span>
      ) : null}
    </button>
  );
}

function UploadTile({
  upload,
  onDismiss,
}: {
  upload: Upload;
  onDismiss: () => void;
}) {
  const percent = Math.round(upload.progress * 100);
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span
        className={`${TILE_FRAME} ${upload.error ? "border-issue bg-issue-wash" : ""}`}
      >
        {upload.error ? (
          <span className="text-issue-strong flex size-full items-center p-3 text-[12px] leading-snug">
            {upload.error}
          </span>
        ) : (
          <>
            {/* A local blob URL: there is nothing for next/image to do. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={upload.preview}
              alt=""
              className="block size-full object-cover object-top opacity-45"
            />
            <span
              role="progressbar"
              aria-label={`Uploading ${upload.name}`}
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="bg-surface absolute inset-x-2.5 bottom-2.5 h-1 overflow-hidden rounded-full"
            >
              <span
                className="bg-pr block h-full rounded-full transition-[width] motion-reduce:transition-none"
                style={{ width: `${percent}%` }}
              />
            </span>
          </>
        )}
      </span>
      <span className="text-ink font-mono text-[12px] leading-snug break-all">
        {upload.name}
      </span>
      {upload.error ? (
        <button
          type="button"
          onClick={onDismiss}
          className="text-ink-muted hover:text-ink self-start text-[11.5px] underline-offset-2 hover:underline"
        >
          Dismiss
        </button>
      ) : (
        <span className="text-ink-muted text-[11.5px]">
          {percent < 100 ? `Uploading, ${percent}%` : "Saving"}
        </span>
      )}
    </div>
  );
}

function DropTile({
  onFiles,
  compact = false,
}: {
  onFiles: (files: readonly File[]) => void;
  compact?: boolean;
}) {
  return (
    <FilePicker
      onFiles={onFiles}
      className="border-hairline bg-surface-raised text-ink-muted hover:border-ink-faint hover:text-ink focus-visible:outline-pr flex aspect-[4/3] w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-[1.5px] border-dashed p-3 text-center text-[12px] leading-snug focus-visible:outline-2"
    >
      <ImageSquare aria-hidden="true" className="size-5" />
      {compact ? (
        <span>Add or drop</span>
      ) : (
        <>
          <span className="text-ink text-[12.5px] font-medium">
            Drop or paste pictures
          </span>
          <span>PNG, JPEG, WebP or GIF, up to 4 MB each</span>
        </>
      )}
    </FilePicker>
  );
}

function DisabledNote() {
  return (
    <p className="text-ink-muted text-[12.5px]">
      Pictures are off on this Fenro. Set <code>UPLOADTHING_TOKEN</code> to turn
      them on.
    </p>
  );
}

function Count({ count }: { count: number }) {
  return count > 0 ? (
    <span className="text-ink-faint ml-1.5 font-mono font-medium">{count}</span>
  ) : null;
}

// --- The task page and the dialog --------------------------------------------

/**
 * The task page's Pictures section: every picture as a tile, newest last,
 * and three ways to add more: the button, dropping files on the section,
 * and pasting anywhere on the page.
 */
export function PicturesSection({
  taskKey,
  pictures,
  removeAction,
  enabled,
}: {
  taskKey: string;
  pictures: readonly PictureItem[];
  removeAction: TaskAction;
  /** False when the app has no picture store configured. */
  enabled: boolean;
}) {
  const { uploads, add, dismiss } = usePictureUploads(taskKey);
  const drop = useDropZone(add);
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section
      aria-label="Pictures"
      {...(enabled ? drop.handlers : {})}
      className={`border-hairline flex flex-col gap-3 rounded-sm border-t pt-5 transition-colors ${drop.over ? "bg-pr-wash outline-pr outline-2 outline-offset-8 outline-dashed" : ""}`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-ink text-[15px] font-semibold tracking-tight">
          Pictures
          <Count count={pictures.length} />
        </h2>
        {enabled ? (
          <FilePicker onFiles={add} className={SECONDARY}>
            <UploadSimple aria-hidden="true" className="size-[13px]" />
            Add pictures
          </FilePicker>
        ) : null}
      </div>
      {pictures.length > 0 || uploads.length > 0 || enabled ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {pictures.map((picture, index) => (
            <PictureTile
              key={picture.id}
              picture={picture}
              onOpen={() => setOpen(index)}
            />
          ))}
          {uploads.map((upload) => (
            <UploadTile
              key={upload.id}
              upload={upload}
              onDismiss={() => dismiss(upload.id)}
            />
          ))}
          {enabled ? <DropTile onFiles={add} /> : null}
        </div>
      ) : null}
      {enabled ? null : <DisabledNote />}
      <PictureViewer
        pictures={pictures}
        index={open}
        onIndex={setOpen}
        taskKey={taskKey}
        removeAction={removeAction}
      />
    </section>
  );
}

/** How many pictures the task dialog shows before sending you to the page. */
const STRIP = 3;

/** The task dialog's short row of the newest pictures, and a way to add. */
export function PictureStrip({
  taskKey,
  pictures,
  removeAction,
  enabled,
  fullPage,
}: {
  taskKey: string;
  pictures: readonly PictureItem[];
  removeAction: TaskAction;
  enabled: boolean;
  fullPage: string;
}) {
  const { uploads, add, dismiss } = usePictureUploads(taskKey);
  const drop = useDropZone(add);
  const [open, setOpen] = useState<number | null>(null);
  if (!enabled && pictures.length === 0) return null;

  const first = Math.max(0, pictures.length - STRIP);
  const shown = pictures.slice(first);
  const hidden = pictures.length - shown.length;

  return (
    <section
      aria-label="Pictures"
      {...(enabled ? drop.handlers : {})}
      className={`flex flex-col gap-3 rounded-sm transition-colors ${drop.over ? "bg-pr-wash outline-pr outline-2 outline-offset-4 outline-dashed" : ""}`}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-ink text-[15px] font-semibold tracking-tight">
          Pictures
          <Count count={pictures.length} />
        </h3>
        {hidden > 0 ? (
          <Link
            href={fullPage}
            className="text-ink-muted hover:text-ink text-[12px]"
          >
            {`All ${pictures.length} on the full page`}
          </Link>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {shown.map((picture, index) => (
          <PictureTile
            key={picture.id}
            picture={picture}
            meta={false}
            onOpen={() => setOpen(first + index)}
          />
        ))}
        {uploads.map((upload) => (
          <UploadTile
            key={upload.id}
            upload={upload}
            onDismiss={() => dismiss(upload.id)}
          />
        ))}
        {enabled ? <DropTile onFiles={add} compact /> : null}
      </div>
      <PictureViewer
        pictures={pictures}
        index={open}
        onIndex={setOpen}
        taskKey={taskKey}
        removeAction={removeAction}
      />
    </section>
  );
}

/** Small thumbnails, as in a journal line, that open the viewer. */
export function PictureThumbs({
  taskKey,
  pictures,
  all,
  removeAction,
}: {
  taskKey: string;
  pictures: readonly PictureItem[];
  /** Every picture on the task, so the viewer can step through them. */
  all: readonly PictureItem[];
  removeAction: TaskAction;
}) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="flex flex-wrap gap-2">
      {pictures.map((picture) => (
        <button
          key={picture.id}
          type="button"
          aria-label={`Open ${picture.name}`}
          onClick={() =>
            setOpen(all.findIndex((other) => other.id === picture.id))
          }
          className="border-hairline bg-surface-sunken hover:border-ink-faint focus-visible:outline-pr block h-[66px] w-[88px] cursor-zoom-in overflow-hidden rounded-md border focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pictureSrc(picture)}
            alt=""
            loading="lazy"
            className="block size-full object-cover object-top"
          />
        </button>
      ))}
      <PictureViewer
        pictures={all}
        index={open}
        onIndex={setOpen}
        taskKey={taskKey}
        removeAction={removeAction}
      />
    </div>
  );
}

// --- The viewer ------------------------------------------------------------------

const VIEWER_BUTTON =
  "border-bar-active bg-bar-active text-bar-ink hover:border-bar-ink-muted focus-visible:outline-bar-ink inline-flex h-[34px] cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[12.5px] font-medium whitespace-nowrap focus-visible:outline-2 disabled:cursor-wait disabled:opacity-70";
const VIEWER_ICON =
  "border-bar-active bg-bar-active text-bar-ink hover:border-bar-ink-muted focus-visible:outline-bar-ink grid size-[38px] cursor-pointer place-items-center rounded-lg border focus-visible:outline-2";

/**
 * One picture, large, over everything: the arrows (or arrow keys) step
 * through the task's pictures, Escape closes. Dark in both schemes, as a
 * picture reads best on a dark surround.
 */
export function PictureViewer({
  pictures,
  index,
  onIndex,
  taskKey,
  removeAction,
}: {
  pictures: readonly PictureItem[];
  index: number | null;
  onIndex: (index: number | null) => void;
  taskKey: string;
  removeAction: TaskAction;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(
    removeAction,
    EMPTY_FORM_STATE,
  );
  const picture = index === null ? undefined : pictures[index];

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (picture && !element.open) element.showModal();
    if (!picture && element.open) element.close();
  }, [picture]);

  // A removal that went through closes the viewer; the list refreshes.
  const removed = useRef(state.saved);
  useEffect(() => {
    if (state.saved === removed.current) return;
    removed.current = state.saved;
    setConfirming(false);
    onIndex(null);
  }, [state.saved, onIndex]);

  const count = pictures.length;
  const step = (by: number) => {
    if (index === null || count === 0) return;
    setConfirming(false);
    onIndex((index + by + count) % count);
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setConfirming(false);
        onIndex(null);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") step(-1);
        if (event.key === "ArrowRight") step(1);
      }}
      onClick={(event) => {
        event.stopPropagation();
        if (event.target === dialog.current) onIndex(null);
      }}
      className="bg-bar text-bar-ink m-0 h-dvh max-h-none w-screen max-w-none p-0 backdrop:bg-transparent"
    >
      {picture ? (
        <div className="flex h-full flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex min-w-0 flex-col gap-0.5">
              <h2
                id={titleId}
                className="font-mono text-[14px] font-medium break-all"
              >
                {picture.name}
              </h2>
              <p className="text-bar-ink-muted text-[12px]">
                {`Added by ${addedByLine(picture)}, ${formatBytes(picture.bytes)}`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={pictureSrc(picture)}
                target="_blank"
                rel="noreferrer noopener"
                className={VIEWER_BUTTON}
              >
                <ArrowSquareOut aria-hidden="true" className="size-3.5" />
                Open original
              </a>
              {confirming ? (
                <form action={formAction} className="flex items-center gap-2">
                  <input type="hidden" name="task" value={taskKey} />
                  <input type="hidden" name="picture" value={picture.id} />
                  <span className="text-bar-ink text-[12.5px]">
                    Remove this picture?
                  </span>
                  <button
                    type="submit"
                    disabled={pending}
                    className={`${VIEWER_BUTTON} text-issue-strong`}
                  >
                    {pending ? "Removing" : "Remove"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className={VIEWER_BUTTON}
                  >
                    Keep
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className={VIEWER_BUTTON}
                >
                  <Trash aria-hidden="true" className="size-3.5" />
                  Remove
                </button>
              )}
              <button
                type="button"
                aria-label="Close"
                onClick={() => onIndex(null)}
                className={VIEWER_ICON}
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>
          </div>
          {state.error ? (
            <p
              role="alert"
              className="bg-issue-wash text-issue-strong mx-4 rounded-lg px-3 py-2 text-[12px] sm:mx-6"
            >
              {state.error}
            </p>
          ) : null}
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-2 sm:px-20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={picture.id}
              src={pictureSrc(picture)}
              alt={picture.name}
              className="block max-h-full max-w-full rounded-lg object-contain"
            />
            {count > 1 ? (
              <>
                <button
                  type="button"
                  aria-label="Previous picture"
                  onClick={() => step(-1)}
                  className={`${VIEWER_ICON} absolute left-3 sm:left-6`}
                >
                  <CaretLeft aria-hidden="true" className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Next picture"
                  onClick={() => step(1)}
                  className={`${VIEWER_ICON} absolute right-3 sm:right-6`}
                >
                  <CaretRight aria-hidden="true" className="size-4" />
                </button>
              </>
            ) : null}
          </div>
          <p className="text-bar-ink-muted flex justify-center gap-6 py-3 text-[12px]">
            <span className="font-mono">{`${(index ?? 0) + 1} of ${count}`}</span>
            <span className="hidden sm:inline">
              Arrow keys move, Esc closes
            </span>
          </p>
        </div>
      ) : null}
    </dialog>
  );
}
