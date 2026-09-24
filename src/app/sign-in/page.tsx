import { redirect } from "next/navigation";

import { signedInUserQuery } from "@/modules/identity/application/queries/signed-in-user";
import {
  SignInPanel,
  signInErrorMessage,
} from "@/modules/identity/ui/sign-in-panel";
import { getContainer } from "@/shared/infrastructure/container";

import { signInWithGitHubAction } from "./actions";

export const metadata = {
  title: "Sign in · Fenro Dashboard",
};

export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  const { queryBus } = await getContainer();
  if (await queryBus.ask(signedInUserQuery())) redirect("/repositories");

  const { error } = await searchParams;
  const code = typeof error === "string" ? error : undefined;

  return (
    <div className="bg-ground text-ink flex min-h-full flex-1 flex-col font-sans">
      <main className="mx-auto grid w-full max-w-[1120px] flex-1 content-start gap-10 px-5 pt-16 pb-8 md:grid-cols-2 md:content-center md:items-center md:gap-[72px] md:px-12 md:py-16">
        <div className="flex flex-col gap-5">
          <span className="text-ink flex items-center gap-2 font-mono text-[15px] font-semibold tracking-tight">
            <span
              aria-hidden="true"
              className="bg-pr text-on-pr grid size-[18px] place-items-center rounded-[5px] text-[11px] font-bold"
            >
              F
            </span>
            Fenro
          </span>
          <SignInPanel
            hero
            heading="Your repositories and your agents' work, on one page"
            action={signInWithGitHubAction}
            error={signInErrorMessage(code)}
          />
        </div>
        <Preview />
      </main>
    </div>
  );
}

/** Invented rows showing what the dashboard looks like; screen readers skip it. */
const PREVIEW = [
  { owner: "acme", name: "billing-core", prs: 6, issues: 23, tasks: 3 },
  { owner: "acme", name: "web-app", prs: 11, issues: 41, tasks: 2 },
  { owner: "acme", name: "mobile", prs: 2, issues: 9, tasks: 0 },
  { owner: "acme", name: "docs-site", prs: 1, issues: 5, tasks: 1 },
];

const PREVIEW_GRID =
  "grid grid-cols-[minmax(0,1fr)_56px_56px_48px] items-center gap-x-2 px-4 sm:grid-cols-[minmax(0,1fr)_70px_70px_60px]";

function Preview() {
  return (
    <div
      aria-hidden="true"
      className="border-hairline bg-surface overflow-hidden rounded-xl border shadow-[0_24px_48px_-24px_rgb(20_18_10/0.25)] md:translate-y-3"
    >
      <div
        className={`${PREVIEW_GRID} bg-surface-raised text-ink-muted border-hairline border-b py-2.5 text-[11.5px]`}
      >
        <span>Repository</span>
        <span>PRs</span>
        <span>Issues</span>
        <span>Tasks</span>
      </div>
      {PREVIEW.map((row) => (
        <div
          key={row.name}
          className={`${PREVIEW_GRID} border-hairline-soft border-t py-3 first-of-type:border-t-0`}
        >
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-mono text-[13px]">{row.name}</span>
            <span className="text-ink-muted text-[11px]">{row.owner}</span>
          </span>
          <span className="text-pr font-mono text-[16px] tabular-nums">
            {row.prs}
          </span>
          <span className="text-issue font-mono text-[16px] tabular-nums">
            {row.issues}
          </span>
          <span className="font-mono text-[16px] tabular-nums">
            {row.tasks}
          </span>
        </div>
      ))}
    </div>
  );
}
