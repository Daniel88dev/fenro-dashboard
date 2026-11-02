"use client";

import { X } from "@phosphor-icons/react/ssr";
import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";

const CloseDialog = createContext<(() => void) | null>(null);

function useClose(): () => void {
  const router = useRouter();
  return useContext(CloseDialog) ?? (() => router.back());
}

export function RouteDialog({
  labelledBy,
  width,
  onClose,
  children,
}: {
  labelledBy: string;
  width: string;
  onClose?: () => void;
  children: ReactNode;
}) {
  const back = useClose();
  const close = onClose ?? back;
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself.
        if (event.target === ref.current) close();
      }}
      className={`border-hairline bg-surface text-ink mx-auto mt-4 mb-4 max-h-[calc(100dvh-32px)] w-[calc(100vw-24px)] max-w-none overflow-hidden rounded-xl border p-0 shadow-[0_24px_64px_-16px_rgba(20,18,10,0.35)] backdrop:bg-[rgba(22,22,18,0.42)] sm:mt-14 sm:max-h-[calc(100dvh-88px)] ${width}`}
    >
      <CloseDialog value={close}>
        <div className="flex max-h-[inherit] flex-col">{children}</div>
      </CloseDialog>
    </dialog>
  );
}

export function CloseDialogButton({ label = "Close" }: { label?: string }) {
  const close = useClose();
  return (
    <button
      type="button"
      aria-label={label}
      onClick={close}
      className="text-ink-soft hover:bg-surface-sunken focus-visible:outline-pr grid size-[30px] cursor-pointer place-items-center rounded-lg focus-visible:outline-2"
    >
      <X aria-hidden="true" className="size-4" />
    </button>
  );
}

export function CancelDialogButton() {
  const close = useClose();
  return (
    <button
      type="button"
      onClick={close}
      className="text-ink-soft hover:bg-surface-sunken focus-visible:outline-pr h-[34px] cursor-pointer rounded-lg px-[13px] text-[12.5px] font-medium focus-visible:outline-2"
    >
      Cancel
    </button>
  );
}
