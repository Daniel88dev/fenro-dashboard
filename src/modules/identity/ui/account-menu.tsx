import { CaretDown, Gear, SignOut } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import type { SignedInUser } from "@/modules/identity/application/ports/authenticator";

/**
 * Who is signed in, and the way out, for the dashboard's top bar. A native
 * disclosure rather than a scripted menu: it needs no client code and the
 * keyboard already works.
 */
export function AccountMenu({
  user,
  signOutAction,
}: {
  user: SignedInUser;
  signOutAction: () => Promise<void>;
}) {
  return (
    <details className="group relative">
      <summary
        aria-label={`Account menu for ${user.githubLogin}`}
        className="text-bar-ink hover:bg-bar-active focus-visible:outline-bar-ink flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-[5px] text-[12.5px] focus-visible:outline-2 [&::-webkit-details-marker]:hidden"
      >
        {user.image ? (
          // A 24px avatar from GitHub's CDN gains nothing from next/image,
          // and would need GitHub added to the image domains to use it.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt=""
            width={24}
            height={24}
            className="rounded-full"
          />
        ) : (
          <span
            aria-hidden="true"
            className="bg-bar-active grid size-6 place-items-center rounded-full font-mono text-[11px] font-semibold uppercase"
          >
            {user.githubLogin.slice(0, 1)}
          </span>
        )}
        <span className="hidden font-mono sm:inline">{user.githubLogin}</span>
        <CaretDown
          aria-hidden="true"
          className="size-3 transition-transform group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <div className="border-hairline bg-surface text-ink absolute right-0 z-20 mt-2 flex w-56 flex-col rounded-xl border p-1.5 shadow-[0_8px_24px_-12px_rgba(20,18,10,0.35)]">
        <p className="text-ink-muted px-2.5 pt-1.5 pb-2 text-[12px]">
          Signed in as{" "}
          <span className="text-ink font-mono">{user.githubLogin}</span>
        </p>
        <Link
          href="/settings"
          className="hover:bg-surface-sunken focus-visible:outline-ink flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] focus-visible:outline-2"
        >
          <Gear aria-hidden="true" className="size-4" />
          Settings
        </Link>
        <form action={signOutAction}>
          <button
            type="submit"
            className="hover:bg-surface-sunken focus-visible:outline-ink flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] focus-visible:outline-2"
          >
            <SignOut aria-hidden="true" className="size-4" />
            Sign out
          </button>
        </form>
      </div>
    </details>
  );
}
