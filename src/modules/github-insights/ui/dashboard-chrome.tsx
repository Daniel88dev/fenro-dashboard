import { FolderSimple, Gear, ListChecks } from "@phosphor-icons/react/ssr";
import type { Icon } from "@phosphor-icons/react";
import Link from "next/link";
import type { ReactNode } from "react";

type Screen = "repositories" | "tasks" | "settings";

const SCREENS: readonly {
  screen: Screen;
  label: string;
  href: string;
  icon: Icon;
}[] = [
  {
    screen: "repositories",
    label: "Repositories",
    href: "/repositories",
    icon: FolderSimple,
  },
  { screen: "tasks", label: "Tasks", href: "/tasks", icon: ListChecks },
  { screen: "settings", label: "Settings", href: "/settings", icon: Gear },
];

/**
 * The near-black bar from the design.
 *
 * At phone width the nav drops below the bar as a row of three buttons, so the
 * bar itself only has to fit the brand and the account menu.
 *
 * `account` is a slot rather than something this component fetches: who is
 * signed in belongs to the identity context, and the route composes the two.
 */
export function DashboardChrome({
  children,
  account,
  current = "repositories",
}: {
  children: ReactNode;
  account?: ReactNode;
  current?: Screen;
}) {
  return (
    <div className="bg-ground text-ink flex min-h-full flex-1 flex-col font-sans">
      <header className="bg-bar text-bar-ink flex shrink-0 flex-wrap items-center gap-x-6 px-4 sm:flex-nowrap sm:px-[26px]">
        <span className="text-bar-ink flex h-14 items-center gap-2 font-mono text-[15px] font-semibold tracking-tight">
          <span
            aria-hidden="true"
            className="bg-pr text-on-pr grid size-[18px] place-items-center rounded-[5px] text-[11px] font-bold"
          >
            F
          </span>
          Fenro
        </span>
        <nav
          aria-label="Main"
          className="order-last grid w-full grid-cols-3 gap-1 pb-2 sm:order-none sm:flex sm:w-auto sm:gap-0.5 sm:pb-0"
        >
          {SCREENS.map(({ screen, label, href, icon: ScreenIcon }) => {
            const here = screen === current;
            return (
              <Link
                key={label}
                href={href}
                aria-current={here ? "page" : undefined}
                className={`focus-visible:outline-bar-ink flex flex-col items-center gap-[3px] rounded-lg px-[11px] py-[7px] text-[11.5px] focus-visible:outline-2 sm:flex-row sm:gap-[7px] sm:text-[13px] ${
                  here
                    ? "bg-bar-active text-bar-ink font-medium"
                    : "text-bar-ink-muted hover:text-bar-ink"
                }`}
              >
                <ScreenIcon
                  aria-hidden="true"
                  className="size-[18px] sm:size-[15px]"
                />
                {label}
              </Link>
            );
          })}
        </nav>
        {account ? (
          <div className="ml-auto flex h-14 items-center">{account}</div>
        ) : null}
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-[18px] px-4 py-5 sm:px-8 sm:py-[26px]">
        {children}
      </main>
    </div>
  );
}
