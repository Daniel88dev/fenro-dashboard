import type { SignedInUser } from "@/modules/identity/application/ports/authenticator";

/** Who is signed in, and the way out, for the dashboard's top bar. */
export function AccountMenu({
  user,
  signOutAction,
}: {
  user: SignedInUser;
  signOutAction: () => Promise<void>;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex items-center gap-2">
        {user.image ? (
          // A 20px avatar from GitHub's CDN gains nothing from next/image,
          // and would need GitHub added to the image domains to use it.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt=""
            width={20}
            height={20}
            className="rounded-full"
          />
        ) : null}
        <span className="text-bar-ink font-mono text-[12.5px]">
          {user.githubLogin}
        </span>
      </span>
      <form action={signOutAction}>
        <button
          type="submit"
          className="text-bar-ink-muted hover:text-bar-ink focus-visible:outline-bar-ink cursor-pointer rounded-lg px-[9px] py-[5px] text-[12.5px] focus-visible:outline-2"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
