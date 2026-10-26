import type { ReactNode } from "react";

import { CopyLine } from "./copy-line";

export const INSTALL_SKILLS_COMMAND =
  "npx skills add https://github.com/Daniel88dev/fenro-dashboard/tree/main/skills";

export function AgentSkills({ appUrl }: { appUrl: string }) {
  return (
    <section
      aria-labelledby="agent-skills-heading"
      className="flex flex-col gap-3.5"
    >
      <div className="flex flex-col gap-1.5">
        <h2
          id="agent-skills-heading"
          className="text-ink text-[16px] font-semibold tracking-tight"
        >
          Agent skills
        </h2>
        <p className="text-ink-muted max-w-[72ch] text-[13px] leading-relaxed">
          Two skills teach a coding agent to work from Fenro:{" "}
          <Code>fenro-setup</Code> connects a repository once, and{" "}
          <Code>fenro-task</Code> picks a task and works it with the skills its
          labels bring. They install into Claude Code, Cursor, Codex and most
          other agents.
        </p>
      </div>

      <ol
        aria-label="Set up a repository"
        className="border-hairline bg-surface divide-hairline-soft flex flex-col divide-y rounded-xl border"
      >
        <Step number={1} title="Install the skills">
          <CopyLine
            label="Run in a terminal, in the repository"
            value={INSTALL_SKILLS_COMMAND}
            button="Copy command"
          />
        </Step>
        <Step number={2} title="Connect the repository">
          <CopyLine
            label="Run in your agent, in that repository"
            value="/fenro-setup"
            button="Copy"
          />
          <p className="text-ink-soft max-w-[72ch] text-[12.5px] leading-relaxed">
            When it asks for your Fenro, give it <Code>{appUrl}</Code>. It sends
            you to <strong className="font-medium">Agent access</strong> below
            for a token that can change tasks, then asks you to restart the
            agent and run <Code>/fenro-setup</Code> again. After that it stores
            your installed skills in Fenro behind labels, asks whether agents
            put their questions on the task or ask in the session, and writes{" "}
            <Code>docs/agents/fenro.md</Code> with a Fenro block in{" "}
            <Code>CLAUDE.md</Code>.
          </p>
        </Step>
        <Step number={3} title="Work a task">
          <CopyLine
            label="Run in your agent, with a task key or none"
            value="/fenro-task"
            button="Copy"
          />
          <p className="text-ink-soft max-w-[72ch] text-[12.5px] leading-relaxed">
            Name a task such as <Code>T-12</Code>, or leave it out to choose
            from your ready tasks. The agent starts it, loads the skills its
            labels bring and finishes with a handoff the next session reads.
          </p>
        </Step>
      </ol>
    </section>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3 px-4 py-4 sm:px-[18px]">
      <span
        aria-hidden="true"
        className="bg-surface-sunken text-ink-soft grid size-6 shrink-0 place-items-center rounded-full font-mono text-[12px] font-semibold tabular-nums"
      >
        {number}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <h3 className="text-ink text-[14px] leading-6 font-semibold">
          {title}
        </h3>
        {children}
      </div>
    </li>
  );
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="bg-surface-sunken text-ink rounded px-1 py-px font-mono text-[12px]">
      {children}
    </code>
  );
}
