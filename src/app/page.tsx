import Link from "next/link";

const modules = [
  {
    name: "GitHub insights",
    description:
      "Open pull requests and issues across the repositories you follow, in one place.",
    path: "src/modules/github-insights",
  },
  {
    name: "Tasks",
    description:
      "An agentic task list that carries context from one session to the next.",
    path: "src/modules/tasks",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-20 sm:px-10">
        <header className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Fenro Dashboard
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            GitHub insights and an agentic task list for the repositories you
            care about.
          </p>
          <Link
            href="/repositories"
            className="w-fit rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200"
          >
            Open the repositories dashboard
          </Link>
        </header>

        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-500">
            Bounded contexts
          </h2>
          <ul className="flex flex-col gap-3">
            {modules.map((module) => (
              <li
                key={module.name}
                className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <h3 className="font-medium text-black dark:text-zinc-50">
                  {module.name}
                </h3>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {module.description}
                </p>
                <code className="mt-3 inline-block font-mono text-xs text-zinc-500">
                  {module.path}
                </code>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
