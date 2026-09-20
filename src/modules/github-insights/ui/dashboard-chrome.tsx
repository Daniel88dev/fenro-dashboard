import type { ReactNode } from "react";

/**
 * The near-black bar from the design. Tasks and Settings are named but not
 * linked: neither screen exists yet, and a link that 404s is worse than a
 * label that waits.
 */
export function DashboardChrome({ children }: { children: ReactNode }) {
  return (
    <div className="bg-ground text-ink flex min-h-full flex-1 flex-col font-sans">
      <header className="bg-bar text-bar-ink flex h-14 shrink-0 items-center gap-6 px-[26px]">
        <span className="font-mono text-[15px] font-medium tracking-tight text-white">
          Fenro
        </span>
        <nav aria-label="Main" className="flex items-center gap-1">
          <span
            aria-current="page"
            className="bg-bar-active rounded-lg px-[11px] py-[7px] text-[13px] font-medium text-white"
          >
            Repositories
          </span>
          <span className="text-bar-ink-muted rounded-lg px-[11px] py-[7px] text-[13px]">
            Tasks
          </span>
          <span className="text-bar-ink-muted rounded-lg px-[11px] py-[7px] text-[13px]">
            Settings
          </span>
        </nav>
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-[18px] px-8 py-[26px]">
        {children}
      </main>
    </div>
  );
}
