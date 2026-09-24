import { CaretDown, Gear, SignOut } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import { Menu } from "@/modules/github-insights/ui/menu";
import { MENU_ITEM } from "@/modules/github-insights/ui/menu-item";
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
    <Menu
      label={`Account menu for ${user.githubLogin}`}
      triggerClassName="text-bar-ink hover:bg-bar-active focus-visible:outline-bar-ink flex items-center gap-2 rounded-lg px-2 py-[5px] text-[12.5px]"
      trigger={
        <>
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
        </>
      }
    >
      <p className="text-ink-muted px-2.5 pt-1.5 pb-2 text-[12px]">
        Signed in as{" "}
        <span className="text-ink font-mono">{user.githubLogin}</span>
      </p>
      <Link href="/settings" className={MENU_ITEM}>
        <Gear aria-hidden="true" className="size-4" />
        Settings
      </Link>
      <form action={signOutAction}>
        <button type="submit" className={MENU_ITEM}>
          <SignOut aria-hidden="true" className="size-4" />
          Sign out
        </button>
      </form>
    </Menu>
  );
}
