import { GithubLogo, WarningCircle } from "@phosphor-icons/react/ssr";

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
 *
 * `hero` is the sign-in page's version: a large headline and no card, next to
 * the preview the page draws. Elsewhere it is a card in the page's flow.
 */
export function SignInPanel({
  action,
  error,
  heading = "Sign in to see your repositories",
  hero = false,
}: {
  action: () => Promise<void>;
  error?: string | null;
  heading?: string;
  hero?: boolean;
}) {
  return (
    <section
      aria-labelledby="sign-in-heading"
      className={
        hero
          ? "flex max-w-[420px] flex-col gap-5"
          : "border-hairline bg-surface flex max-w-[440px] flex-col gap-4 rounded-xl border px-5 py-5 sm:px-6 sm:py-6"
      }
    >
      <div className="flex flex-col gap-2.5">
        <h1
          id="sign-in-heading"
          className={
            hero
              ? "text-ink text-[28px] leading-[1.15] font-semibold tracking-[-0.03em] text-balance sm:text-[34px]"
              : "text-ink text-[18px] font-semibold tracking-tight"
          }
        >
          {heading}
        </h1>
        <p
          className={`text-ink-muted leading-relaxed ${hero ? "text-[15px]" : "text-[13px]"}`}
        >
          {hero
            ? "Open pull requests, issues and tasks for the repositories you follow."
            : "Fenro reads pull requests, issues and checks with your own GitHub account, so it sees exactly what you can see, private repositories included."}
        </p>
      </div>

      {error ? (
        <p
          role="alert"
          className="bg-issue-wash text-issue-strong flex items-start gap-2 rounded-lg px-3 py-2.5 text-[12.5px] leading-relaxed"
        >
          <WarningCircle aria-hidden="true" className="mt-px size-4 shrink-0" />
          {error}
        </p>
      ) : null}

      <form action={action} className="flex flex-col items-start gap-2.5">
        <button
          type="submit"
          className={`border-ink bg-ink text-ground hover:bg-ink-soft focus-visible:outline-pr inline-flex cursor-pointer items-center gap-2 rounded-lg border font-medium focus-visible:outline-2 focus-visible:outline-offset-2 ${hero ? "h-[42px] px-[18px] text-[14px]" : "h-[38px] px-4 text-[13px]"}`}
        >
          <GithubLogo
            aria-hidden="true"
            weight="fill"
            className={hero ? "size-[18px]" : "size-4"}
          />
          Sign in with GitHub
        </button>
        {hero ? (
          <span className="text-ink-muted text-[12.5px] leading-relaxed">
            Fenro reads GitHub with your own account, so it sees exactly what
            you can see.
          </span>
        ) : null}
      </form>
    </section>
  );
}
