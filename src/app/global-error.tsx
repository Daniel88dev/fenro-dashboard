"use client";

import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

/**
 * The last boundary: an error that breaks the root layout lands here instead
 * of reaching window.onerror, so it is reported by hand. It shows the same
 * page Next.js shows without this file.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        {/* The App Router does not pass a status code; 0 shows the generic message. */}
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
