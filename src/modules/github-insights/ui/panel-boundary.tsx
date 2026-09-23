"use client";

import { catchError, type ErrorInfo } from "next/error";

import { ChecksMessage, PanelError } from "./panel";

/**
 * Expected failures arrive from a query as values and render as `PanelError`
 * on the server. This catches the rest — the database gone, a bug — so one
 * panel breaking still leaves the table standing. The server's
 * message is redacted in production, so the copy here is fixed.
 */
function PanelFallback(
  { id, title, what }: { id: string; title: string; what: string },
  { retry }: ErrorInfo,
) {
  return (
    <PanelError
      id={id}
      title={title}
      message={`${what} could not be loaded.`}
      action={<RetryButton onRetry={retry} />}
    />
  );
}

export const PanelBoundary = catchError(PanelFallback);

function ChecksFallback(
  { id, number }: { id: string; number: number },
  { retry }: ErrorInfo,
) {
  return (
    <ChecksMessage id={id} tone="attention">
      <span>{`The checks for #${number} could not be loaded.`}</span>
      <RetryButton onRetry={retry} />
    </ChecksMessage>
  );
}

export const ChecksBoundary = catchError(ChecksFallback);

function RetryButton({ onRetry }: { onRetry: () => void }) {
  return (
    <button
      type="button"
      onClick={onRetry}
      className="text-issue-strong focus-visible:outline-issue cursor-pointer font-medium underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      Try again
    </button>
  );
}
