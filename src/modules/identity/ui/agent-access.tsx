"use client";

import { useActionState, useId, useState } from "react";

import type { AccessTokenSummary } from "@/modules/identity/application/queries/access-tokens";

export type IssueTokenState = {
  readonly error: string | null;
  /** The secret, present only in the response that created it. */
  readonly issued: { readonly name: string; readonly secret: string } | null;
};

export const EMPTY_ISSUE_STATE: IssueTokenState = { error: null, issued: null };

export const LIFETIMES = [
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 366, label: "1 year" },
] as const;

const STATE_LABELS: Record<AccessTokenSummary["state"], string> = {
  active: "Active",
  expired: "Expired",
  revoked: "Revoked",
};

const DATE = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const formatDate = (iso: string) => DATE.format(new Date(iso));

/** The command a person pastes into Claude Code to connect it. */
export function connectCommand(serverUrl: string, secret: string): string {
  return `claude mcp add --transport http fenro ${serverUrl} --header "Authorization: Bearer ${secret}"`;
}

/**
 * Where a person lets an agent in: each token is one agent's key to the MCP
 * server, acting as this person on their tasks. The secret is shown once,
 * right after it is made, because only its hash is kept.
 */
export function AgentAccess({
  serverUrl,
  tokens,
  issueAction,
  revokeAction,
}: {
  serverUrl: string;
  tokens: readonly AccessTokenSummary[];
  issueAction: (
    state: IssueTokenState,
    formData: FormData,
  ) => Promise<IssueTokenState>;
  revokeAction: (formData: FormData) => Promise<void>;
}) {
  const nameId = useId();
  const lifetimeId = useId();
  const [state, formAction, pending] = useActionState(
    issueAction,
    EMPTY_ISSUE_STATE,
  );

  return (
    <section
      aria-labelledby="agent-access-heading"
      className="border-hairline bg-surface flex max-w-[760px] flex-col gap-5 rounded-xl border px-6 py-6"
    >
      <div className="flex flex-col gap-1.5">
        <h2
          id="agent-access-heading"
          className="text-ink text-[16px] font-semibold tracking-tight"
        >
          Agent access
        </h2>
        <p className="text-ink-muted text-[13px] leading-relaxed">
          An agent connects to the tasks MCP server at{" "}
          <code className="text-ink-soft font-mono text-[12px]">
            {serverUrl}
          </code>{" "}
          with a token made here. It works on your tasks as you, so give each
          agent its own token and revoke it when you stop using it.
        </p>
      </div>

      {state.issued ? (
        <NewSecret
          name={state.issued.name}
          secret={state.issued.secret}
          serverUrl={serverUrl}
        />
      ) : null}

      <form
        action={formAction}
        aria-label="Create an agent token"
        className="flex flex-wrap items-end gap-3"
      >
        <div className="flex min-w-[220px] flex-1 flex-col gap-1">
          <label htmlFor={nameId} className="text-ink-soft text-[12px]">
            Name
          </label>
          {/* Not a login field: the attributes keep password managers off it. */}
          <input
            id={nameId}
            name="name"
            required
            maxLength={60}
            placeholder="Claude Code on my laptop"
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            data-bwignore
            data-form-type="other"
            className="border-hairline bg-surface text-ink placeholder:text-ink-faint focus-visible:outline-pr h-[34px] rounded-[9px] border px-3 text-[13px] focus-visible:outline-2 focus-visible:outline-offset-1"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={lifetimeId} className="text-ink-soft text-[12px]">
            Expires after
          </label>
          <select
            id={lifetimeId}
            name="lifetimeDays"
            defaultValue={90}
            className="border-hairline bg-surface text-ink focus-visible:outline-pr h-[34px] rounded-[9px] border px-2 text-[13px] focus-visible:outline-2 focus-visible:outline-offset-1"
          >
            {LIFETIMES.map(({ days, label }) => (
              <option key={days} value={days}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <label className="text-ink-soft flex h-[34px] items-center gap-2 text-[12.5px]">
          <input
            type="checkbox"
            name="write"
            defaultChecked
            className="accent-pr"
          />
          Can change tasks
        </label>
        <button
          type="submit"
          disabled={pending}
          className="border-ink bg-ink text-ground hover:bg-ink-soft focus-visible:outline-pr h-[34px] cursor-pointer rounded-[9px] border px-[13px] text-[12.5px] font-medium focus-visible:outline-2 focus-visible:outline-offset-1 disabled:cursor-wait disabled:opacity-70"
        >
          {pending ? "Creating…" : "Create token"}
        </button>
      </form>

      {state.error ? (
        <p
          role="alert"
          className="border-issue-wash bg-issue-wash text-issue-strong rounded-lg border px-3 py-2 text-[12px]"
        >
          {state.error}
        </p>
      ) : null}

      {tokens.length === 0 ? (
        <p className="text-ink-muted text-[12.5px]">
          No tokens yet. Agents cannot reach your tasks until you make one.
        </p>
      ) : (
        <ul
          aria-label="Agent tokens"
          className="divide-hairline-soft border-hairline divide-y rounded-[10px] border"
        >
          {tokens.map((token) => (
            <TokenRow
              key={token.id}
              token={token}
              revokeAction={revokeAction}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function NewSecret({
  name,
  secret,
  serverUrl,
}: {
  name: string;
  secret: string;
  serverUrl: string;
}) {
  const command = connectCommand(serverUrl, secret);
  return (
    <div
      role="status"
      className="border-pr-wash bg-pr-wash flex flex-col gap-2 rounded-[10px] border px-4 py-3"
    >
      <p className="text-pr-strong text-[12.5px] font-medium">
        Token “{name}” created. Copy it now: it will not be shown again.
      </p>
      <CopyLine label="Token" value={secret} />
      <CopyLine label="Connect Claude Code" value={command} />
    </div>
  );
}

function CopyLine({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard access can be refused; the text stays selectable.
    }
  };
  return (
    <div className="flex flex-col gap-1">
      <span className="text-ink-soft text-[11.5px]">{label}</span>
      <div className="flex items-start gap-2">
        <code className="bg-surface text-ink flex-1 rounded-md px-2 py-1.5 font-mono text-[12px] break-all select-all">
          {value}
        </code>
        <button
          type="button"
          onClick={copy}
          aria-label={`Copy ${label.toLowerCase()}`}
          className="border-hairline bg-surface text-ink hover:bg-surface-sunken focus-visible:outline-pr shrink-0 cursor-pointer rounded-[8px] border px-[10px] py-1 text-[12px] font-medium focus-visible:outline-2"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function TokenRow({
  token,
  revokeAction,
}: {
  token: AccessTokenSummary;
  revokeAction: (formData: FormData) => Promise<void>;
}) {
  const canChange = token.scopes.includes("tasks:write");
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
      <div className="flex min-w-[200px] flex-1 flex-col gap-0.5">
        <span className="text-ink text-[13px] font-medium">{token.name}</span>
        <span className="text-ink-muted text-[12px]">
          <span className="font-mono">…{token.hint}</span> ·{" "}
          {canChange ? "Reads and changes tasks" : "Reads tasks"} ·{" "}
          {token.lastUsedAt
            ? `last used ${formatDate(token.lastUsedAt)}`
            : "never used"}
        </span>
      </div>
      <span className="text-ink-muted text-[12px]">
        {token.state === "active"
          ? `Expires ${formatDate(token.expiresAt)}`
          : STATE_LABELS[token.state]}
      </span>
      {token.state === "active" ? (
        <form action={revokeAction}>
          <input type="hidden" name="tokenId" value={token.id} />
          <button
            type="submit"
            aria-label={`Revoke ${token.name}`}
            className="border-hairline text-issue-strong hover:bg-issue-wash focus-visible:outline-pr cursor-pointer rounded-[8px] border px-[10px] py-1 text-[12px] font-medium focus-visible:outline-2"
          >
            Revoke
          </button>
        </form>
      ) : null}
    </li>
  );
}
