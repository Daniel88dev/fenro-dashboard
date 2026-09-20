import { Suspense } from "react";

import { DashboardChrome } from "@/modules/github-insights/ui/dashboard-chrome";

import { RepositoriesScreen } from "./repositories-screen";

export const metadata = {
  title: "Repositories · Fenro Dashboard",
  description:
    "Open pull requests, issues and tasks for the repositories you watch.",
};

/**
 * The page never awaits `searchParams`: it hands the promise down so the chrome
 * around the table can be part of the static shell. See
 * docs/research/nextjs-16-rendering-strategy.md.
 */
export default function RepositoriesPage({
  searchParams,
}: PageProps<"/repositories">) {
  return (
    <DashboardChrome>
      <Suspense fallback={<TableSkeleton />}>
        <RepositoriesScreen searchParams={searchParams} />
      </Suspense>
    </DashboardChrome>
  );
}

function TableSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="border-hairline bg-surface text-ink-muted rounded-xl border px-[18px] py-10 text-[13px]"
    >
      Loading the repositories you watch…
    </div>
  );
}
