/** GitHub's mark, drawn in the button's own colour. */
function GitHubMark() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="currentColor"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

/**
 * Better Auth sends the browser back with `?error=<code>` when sign-in does
 * not complete. Cancelling on GitHub's consent screen is the common case and
 * deserves plain words; anything else names its code so it can be looked up.
 */
export function signInErrorMessage(code: string | undefined): string | null {
  if (!code) return null;
  if (code === "access_denied") {
    return "Sign-in was cancelled on GitHub. Nothing was shared.";
  }
  return `GitHub sign-in did not complete (${code}). Try again.`;
}

/**
 * The signed-out state. GitHub is the only way in, so it is one button, and a
 * plain form: it works before any JavaScript has loaded.
 */
export function SignInPanel({
  action,
  error,
  heading = "Sign in to see your repositories",
}: {
  action: () => Promise<void>;
  error?: string | null;
  heading?: string;
}) {
  return (
    <section
      aria-labelledby="sign-in-heading"
      className="border-hairline bg-surface flex max-w-[440px] flex-col gap-4 rounded-xl border px-6 py-6"
    >
      <div className="flex flex-col gap-1.5">
        <h1
          id="sign-in-heading"
          className="text-ink text-[18px] font-semibold tracking-tight"
        >
          {heading}
        </h1>
        <p className="text-ink-muted text-[13px] leading-relaxed">
          Fenro reads pull requests, issues and checks with your own GitHub
          account, so it sees exactly what you can see, private repositories
          included.
        </p>
      </div>

      {error ? (
        <p
          role="alert"
          className="border-issue-wash bg-issue-wash text-issue-strong rounded-lg border px-3 py-2 text-[12px]"
        >
          {error}
        </p>
      ) : null}

      <form action={action}>
        <button
          type="submit"
          className="border-ink bg-ink text-ground hover:bg-ink-soft focus-visible:outline-pr inline-flex h-[38px] cursor-pointer items-center gap-2 rounded-[9px] border px-4 text-[13px] font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <GitHubMark />
          Sign in with GitHub
        </button>
      </form>
    </section>
  );
}
