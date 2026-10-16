"use client";

import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

// An error that breaks the root layout never reaches window.onerror, so it is
// reported by hand.
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
