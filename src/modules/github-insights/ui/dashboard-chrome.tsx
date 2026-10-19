import {
  BookOpenText,
  FolderSimple,
  Gear,
  Kanban,
  ListChecks,
  Plus,
} from "@phosphor-icons/react/ssr";
import type { Icon } from "@phosphor-icons/react";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  SearchPalette,
  type PalettePage,
} from "@/modules/tasks/ui/search-palette";

import { FenroMark } from "./fenro-mark";
import { SavedThemeToggle } from "./saved-theme-toggle";

type Screen = "repositories" | "tasks" | "skills" | "settings";

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
  {
    screen: "skills",
    label: "Skills & labels",
    href: "/skills",
    icon: BookOpenText,
  },
  { screen: "settings", label: "Settings", href: "/settings", icon: Gear },
];

const PALETTE_PAGES: readonly PalettePage[] = [
  ...SCREENS.map(({ label, href, icon: ScreenIcon }) => ({
    label,
    href,
    icon: <ScreenIcon aria-hidden="true" />,
  })),
  {
    label: "Task board",
    href: "/tasks?layout=board",
    icon: <Kanban aria-hidden="true" />,
  },
  { label: "New task", href: "/tasks/new", icon: <Plus aria-hidden="true" /> },
];

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
      <header className="bg-bar text-bar-ink flex shrink-0 flex-wrap items-center gap-x-3 px-4 sm:sticky sm:top-0 sm:z-40 sm:flex-nowrap sm:gap-x-6 sm:px-[26px]">
        <span className="text-bar-ink flex h-14 items-center gap-2 font-mono text-[15px] font-semibold tracking-tight">
          <FenroMark className="size-5" />
          Fenro
        </span>
        <nav
          aria-label="Main"
          className="order-last grid w-full grid-cols-4 gap-1 pb-2 sm:order-none sm:flex sm:w-auto sm:gap-0.5 sm:pb-0"
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
        <div className="ml-auto flex h-14 min-w-0 items-center sm:ml-0 sm:flex-1">
          <SearchPalette pages={PALETTE_PAGES} />
        </div>
        <div className="flex h-14 items-center gap-2">
          <div className="hidden sm:flex">
            <SavedThemeToggle />
          </div>
          {account}
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-[18px] px-4 py-5 sm:px-8 sm:py-[26px]">
        {children}
      </main>
    </div>
  );
}
