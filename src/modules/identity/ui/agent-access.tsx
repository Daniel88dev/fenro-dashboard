"use client";

import { Check, Copy, Key, WarningCircle } from "@phosphor-icons/react/ssr";
import { useActionState, useId, useState } from "react";

import { Chip } from "@/modules/github-insights/ui/chip";

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

const FIELD =
  "border-hairline bg-surface text-ink placeholder:text-ink-faint focus-visible:outline-pr rounded-lg border px-3 text-[13px] focus-visible:outline-2 focus-visible:outline-offset-1";
const BUTTON =
  "focus-visible:outline-pr inline-flex h-[34px] cursor-pointer items-center gap-1.5 rounded-lg border px-[13px] text-[12.5px] font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-1 disabled:cursor-wait disabled:opacity-70";
const PRIMARY = `${BUTTON} border-ink bg-ink text-ground hover:bg-ink-soft`;
const SECONDARY = `${BUTTON} border-hairline bg-surface text-ink hover:bg-surface-sunken`;

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
      className="flex flex-col gap-3.5"
    >
      <div className="flex flex-col gap-1.5">
        <h2
          id="agent-access-heading"
          className="text-ink text-[16px] font-semibold tracking-tight"
        >
          Agent access
        </h2>
        <p className="text-ink-muted max-w-[72ch] text-[13px] leading-relaxed">
          Agents connect to the tasks MCP server with a token made here and work
          on your tasks as you. Give each agent its own token and revoke it when
          you stop using it.
        </p>
      </div>

      <CopyLine label="MCP server URL" value={serverUrl} button="Copy URL" />

      <div className="border-hairline bg-surface flex flex-col gap-4 rounded-xl border p-4 sm:p-[18px]">
        <h3 className="text-ink text-[14px] font-semibold">Create a token</h3>
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
              className={`${FIELD} h-[34px]`}
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
              className={`${FIELD} h-[34px] px-2`}
            >
              {LIFETIMES.map(({ days, label }) => (
                <option key={days} value={days}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <label className="text-ink-soft flex h-[34px] items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              name="write"
              defaultChecked
              className="accent-pr size-4"
            />
            Can change tasks
          </label>
          <button type="submit" disabled={pending} className={PRIMARY}>
            <Key aria-hidden="true" className="size-[15px]" />
            {pending ? "Creating…" : "Create token"}
          </button>
        </form>

        {state.error ? (
          <p
            role="alert"
            className="bg-issue-wash text-issue-strong flex items-center gap-2 rounded-lg px-3 py-2 text-[12.5px]"
          >
            <WarningCircle aria-hidden="true" className="size-4 shrink-0" />
            {state.error}
          </p>
        ) : null}

        {state.issued ? (
          <NewSecret
            name={state.issued.name}
            secret={state.issued.secret}
            serverUrl={serverUrl}
          />
        ) : null}
      </div>

      {tokens.length === 0 ? (
        <p className="text-ink-muted text-[13px]">
          No tokens yet. Agents cannot reach your tasks until you make one.
        </p>
      ) : (
        <div className="border-hairline bg-surface overflow-hidden rounded-xl border">
          <div
            aria-hidden="true"
            className={`${TOKEN_GRID} bg-surface-raised text-ink-muted border-hairline hidden border-b py-2.5 text-[12px] font-medium md:grid`}
          >
            <span>Name</span>
            <span>Access</span>
            <span>Created</span>
            <span>Expires</span>
            <span>Last used</span>
            <span>State</span>
            <span />
          </div>
          <ul
            aria-label="Agent tokens"
            className="divide-hairline-soft divide-y"
          >
            {tokens.map((token) => (
              <TokenRow
                key={token.id}
                token={token}
                revokeAction={revokeAction}
              />
            ))}
          </ul>
        </div>
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
      className="bg-pr-wash flex flex-col gap-3 rounded-xl px-3.5 py-3.5"
    >
      <p className="text-pr-strong text-[12.5px] font-semibold">
        Token “{name}” created. Copy it now. Fenro keeps only a hash, so this is
        the one time you see it.
      </p>
      <CopyLine label="Token" value={secret} button="Copy token" />
      <CopyLine
        label="Connect Claude Code"
        value={command}
        button="Copy command"
      />
    </div>
  );
}

function CopyLine({
  label,
  value,
  button,
}: {
  label: string;
  value: string;
  button: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // Clipboard access can be refused; the text stays selectable.
    }
  };
  // The value box hugs a short value from `sm` up but may still shrink, so a
  // long one (the connect command) wraps inside the card instead of pushing
  // the button past its edge.
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-ink-soft text-[12px]">{label}</span>
      <div className="flex items-start gap-2">
        <code className="border-hairline bg-surface text-ink min-h-[34px] min-w-0 flex-1 rounded-lg border px-3 py-[7px] font-mono text-[12px] leading-[18px] break-all select-all sm:flex-initial">
          {value}
        </code>
        <button
          type="button"
          onClick={copy}
          aria-label={`Copy ${label.toLowerCase()}`}
          className={`${SECONDARY} shrink-0`}
        >
          {copied ? (
            <Check aria-hidden="true" className="size-[15px]" />
          ) : (
            <Copy aria-hidden="true" className="size-[15px]" />
          )}
          <span className="hidden sm:inline">{copied ? "Copied" : button}</span>
        </button>
      </div>
    </div>
  );
}

/**
 * One grid for the header and the rows, so the columns line up. Under `md`
 * a row stacks: name on top, facts below with their own labels.
 */
const TOKEN_GRID =
  "md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_80px_80px] items-center gap-x-4 px-4";

function TokenRow({
  token,
  revokeAction,
}: {
  token: AccessTokenSummary;
  revokeAction: (formData: FormData) => Promise<void>;
}) {
  const canChange = token.scopes.includes("tasks:write");
  const facts: readonly [string, string][] = [
    ["Access", canChange ? "Read and write" : "Read only"],
    ["Created", formatDate(token.createdAt)],
    ["Expires", formatDate(token.expiresAt)],
    ["Last used", token.lastUsedAt ? formatDate(token.lastUsedAt) : "Never"],
  ];
  return (
    <li
      className={`${TOKEN_GRID} grid grid-cols-[minmax(0,1fr)_auto] gap-y-2 py-3 text-[13px]`}
    >
      <span className="flex min-w-0 flex-col">
        <span className="text-ink font-medium break-words">{token.name}</span>
        <span className="text-ink-muted font-mono text-[11.5px]">
          …{token.hint}
        </span>
      </span>
      <dl className="col-span-2 row-start-2 grid grid-cols-2 gap-x-4 gap-y-1 md:contents">
        {facts.map(([label, value], i) => (
          <div key={label} className="flex min-w-0 flex-col md:block">
            <dt className="text-ink-muted text-[11.5px] md:sr-only">{label}</dt>
            <dd className={i === 0 ? "text-ink-soft" : "text-ink-muted"}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <span className="col-start-2 row-start-1 flex items-center justify-end gap-2 md:contents">
        <span>
          <Chip tone={token.state === "active" ? "healthy" : "neutral"}>
            {STATE_LABELS[token.state]}
          </Chip>
        </span>
        <span className="md:flex md:justify-end">
          {token.state === "active" ? (
            <form action={revokeAction}>
              <input type="hidden" name="tokenId" value={token.id} />
              <button
                type="submit"
                aria-label={`Revoke ${token.name}`}
                className="text-issue-strong hover:bg-issue-wash focus-visible:outline-pr h-[30px] cursor-pointer rounded-lg px-[10px] text-[12px] font-medium focus-visible:outline-2"
              >
                Revoke
              </button>
            </form>
          ) : null}
        </span>
      </span>
    </li>
  );
}
