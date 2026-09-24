import Link from "next/link";
import type { ReactNode } from "react";

type Screen = "repositories" | "tasks" | "settings";

const SCREENS: readonly {
  screen: Screen;
  label: string;
  href: string;
}[] = [
  { screen: "repositories", label: "Repositories", href: "/repositories" },
  { screen: "tasks", label: "Tasks", href: "/tasks" },
  { screen: "settings", label: "Settings", href: "/settings" },
];

/**
 * The near-black bar from the design.
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
      <header className="bg-bar text-bar-ink flex h-14 shrink-0 items-center gap-6 px-[26px]">
        <span className="text-bar-ink font-mono text-[15px] font-medium tracking-tight">
          Fenro
        </span>
        <nav aria-label="Main" className="flex items-center gap-1">
          {SCREENS.map(({ screen, label, href }) => {
            const here = screen === current;
            const className = here
              ? "bg-bar-active text-bar-ink rounded-lg px-[11px] py-[7px] text-[13px] font-medium"
              : "text-bar-ink-muted rounded-lg px-[11px] py-[7px] text-[13px]";
            return !here ? (
              <Link
                key={label}
                href={href}
                className={`${className} hover:text-bar-ink focus-visible:outline-bar-ink focus-visible:outline-2`}
              >
                {label}
              </Link>
            ) : (
              <span
                key={label}
                aria-current={here ? "page" : undefined}
                className={className}
              >
                {label}
              </span>
            );
          })}
        </nav>
        {account ? <div className="ml-auto">{account}</div> : null}
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-[18px] px-8 py-[26px]">
        {children}
      </main>
    </div>
  );
}
