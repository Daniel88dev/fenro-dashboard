import { SignOut } from "@phosphor-icons/react/ssr";

import type { SignedInUser } from "@/modules/identity/application/ports/authenticator";

/** Who is signed in on the settings page, what that lets Fenro read, and the way out. */
export function AccountSection({
  user,
  signOutAction,
}: {
  user: SignedInUser;
  signOutAction: () => Promise<void>;
}) {
  return (
    <section
      aria-labelledby="account-heading"
      className="flex flex-col gap-3.5"
    >
      <h2
        id="account-heading"
        className="text-ink text-[16px] font-semibold tracking-tight"
      >
        Account
      </h2>
      <div className="border-hairline bg-surface flex flex-wrap items-center gap-x-3.5 gap-y-3 rounded-xl border px-4 py-4 sm:px-[18px]">
        {user.image ? (
          // Same reason as the account menu: a small GitHub avatar.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt=""
            width={40}
            height={40}
            className="rounded-full"
          />
        ) : (
          <span
            aria-hidden="true"
            className="bg-neutral-wash text-ink-soft grid size-10 place-items-center rounded-full font-mono text-[16px] font-semibold uppercase"
          >
            {user.githubLogin.slice(0, 1)}
          </span>
        )}
        <div className="flex min-w-[200px] flex-1 flex-col gap-0.5">
          <span className="text-ink font-mono text-[14px] font-medium">
            {user.githubLogin}
          </span>
          <span className="text-ink-muted text-[12.5px] leading-relaxed">
            Signed in with GitHub. Fenro reads your profile, your email address
            and the repositories you can see, private ones included.
          </span>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            className="border-hairline bg-surface text-ink hover:bg-surface-sunken focus-visible:outline-pr inline-flex h-[34px] cursor-pointer items-center gap-1.5 rounded-lg border px-[13px] text-[12.5px] font-medium focus-visible:outline-2 focus-visible:outline-offset-1"
          >
            <SignOut aria-hidden="true" className="size-[15px]" />
            Sign out
          </button>
        </form>
      </div>
    </section>
  );
}
