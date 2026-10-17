"use client";

import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { unstable_isUnrecognizedActionError } from "next/navigation";
import { useEffect } from "react";

// An error that breaks the root layout never reaches window.onerror, so it is
// reported by hand.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  const staleBuild = unstable_isUnrecognizedActionError(error);

  useEffect(() => {
    // A page from before the latest release calls server actions by ids the
    // new build does not have; loading the page again picks up the new ones.
    if (staleBuild) window.location.reload();
    else Sentry.captureException(error);
  }, [error, staleBuild]);

  if (staleBuild) {
    return (
      <html lang="en">
        <body />
      </html>
    );
  }

  return (
    <html lang="en">
      <body>
        {/* The App Router does not pass a status code; 0 shows the generic message. */}
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
