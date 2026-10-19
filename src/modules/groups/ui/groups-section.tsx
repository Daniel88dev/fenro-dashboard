"use client";

import { CaretRight, Lock, Plus, X } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { useId, useRef, useState } from "react";

import type {
  GroupSummaryRecord,
  InvitationRecord,
} from "@/modules/groups/application/ports/group-read-store";
import { suggestKeyPrefix } from "@/modules/groups/domain/key-prefix";

import type { GroupAction } from "./group-form-state";
import {
  FIELD,
  GroupForm,
  NOT_A_LOGIN,
  PRIMARY,
  SECONDARY,
} from "./group-form";

const PREFIX = /^[A-Z]{2,5}$/;

const members = (count: number) =>
  count === 1 ? "1 member" : `${count} members`;

export function PrefixBadge({ prefix }: { prefix: string }) {
  return (
    <span className="bg-surface-sunken text-ink-soft min-w-[38px] shrink-0 rounded-md px-1.5 py-0.5 text-center font-mono text-[11.5px] font-semibold">
      {prefix}
    </span>
  );
}

export function GroupsSection({
  groups,
  invitations,
  createAction,
  answerAction,
}: {
  groups: readonly GroupSummaryRecord[];
  invitations: readonly InvitationRecord[];
  createAction: GroupAction;
  answerAction: GroupAction;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <section
      id="groups"
      aria-labelledby="groups-heading"
      className="flex scroll-mt-20 flex-col gap-3.5"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <h2
            id="groups-heading"
            className="text-ink text-[16px] font-semibold tracking-tight"
          >
            Groups
          </h2>
          <p className="text-ink-muted max-w-[72ch] text-[13px] leading-relaxed">
            Every member sees and works on a group&apos;s tasks. Its tasks are
            numbered with its own prefix, so they never clash with your T- keys.
          </p>
        </div>
        <button
          type="button"
          onClick={() => dialog.current?.showModal()}
          className={PRIMARY}
        >
          <Plus aria-hidden="true" weight="bold" className="size-[15px]" />
          New group
        </button>
      </div>

      {invitations.map((invitation) => (
        <GroupForm
          key={invitation.groupId}
          action={answerAction}
          label={`Invitation to ${invitation.name}`}
          fields={{ group: invitation.groupId }}
          className="border-pr bg-pr-wash flex flex-wrap items-center gap-x-3 gap-y-2.5 rounded-xl border px-4 py-3"
        >
          {(pending) => (
            <>
              <PrefixBadge prefix={invitation.prefix} />
              <p className="text-ink min-w-[200px] flex-1 text-[13px]">
                <strong className="font-semibold">{invitation.name}</strong>{" "}
                invited you.{" "}
                <span className="text-ink-muted">
                  Invited by{" "}
                  <span className="font-mono">{invitation.invitedByLogin}</span>
                  , {members(invitation.members)}.
                </span>
              </p>
              <span className="flex gap-2">
                <button
                  type="submit"
                  name="answer"
                  value="decline"
                  disabled={pending}
                  className={SECONDARY}
                >
                  Decline
                </button>
                <button
                  type="submit"
                  name="answer"
                  value="join"
                  disabled={pending}
                  className={PRIMARY}
                >
                  Join
                </button>
              </span>
            </>
          )}
        </GroupForm>
      ))}

      {groups.length > 0 ? (
        <ul className="border-hairline bg-surface divide-hairline-soft m-0 list-none divide-y overflow-hidden rounded-xl border p-0">
          {groups.map((group) => (
            <li key={group.id}>
              <Link
                href={`/groups/${group.prefix}`}
                className="hover:bg-surface-raised focus-visible:outline-pr flex items-center gap-3 px-4 py-3 focus-visible:outline-2 focus-visible:-outline-offset-2 sm:px-[18px]"
              >
                <PrefixBadge prefix={group.prefix} />
                <span className="text-ink min-w-0 flex-1 truncate text-[14px] font-medium">
                  {group.name}
                </span>
                <span className="text-ink-muted text-[12.5px]">
                  {group.role === "owner" ? "Owner" : "Member"}
                </span>
                <span className="text-ink-muted hidden text-[12.5px] sm:inline">
                  {members(group.members)}
                </span>
                <CaretRight
                  aria-hidden="true"
                  className="text-ink-faint size-3.5"
                />
              </Link>
            </li>
          ))}
        </ul>
      ) : invitations.length === 0 ? (
        <p className="border-hairline bg-surface text-ink-muted rounded-xl border px-5 py-6 text-center text-[13px]">
          You are in no group yet. Create one, or ask a group&apos;s owner to
          invite your GitHub username.
        </p>
      ) : null}

      <NewGroupDialog dialog={dialog} action={createAction} />
    </section>
  );
}

function NewGroupDialog({
  dialog,
  action,
}: {
  dialog: React.RefObject<HTMLDialogElement | null>;
  action: GroupAction;
}) {
  const nameId = useId();
  const prefixId = useId();
  const helpId = useId();
  const [name, setName] = useState("");
  const [prefix, setPrefix] = useState("");
  const [touched, setTouched] = useState(false);
  const shown = touched ? prefix : suggestKeyPrefix(name);
  const valid = PREFIX.test(shown);
  const close = () => dialog.current?.close();

  return (
    <dialog
      ref={dialog}
      aria-labelledby={`${nameId}-title`}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself.
        if (event.target === event.currentTarget) close();
      }}
      className="border-hairline bg-surface text-ink m-auto w-[calc(100vw-24px)] max-w-[480px] rounded-xl border p-0 shadow-[0_24px_64px_-16px_rgba(20,18,10,0.35)] backdrop:bg-[rgba(22,22,18,0.42)]"
    >
      <GroupForm
        action={action}
        label="New group"
        fields={{}}
        className="flex flex-col [&>[role=alert]]:mx-5 [&>[role=alert]]:mb-3"
      >
        {(pending) => (
          <>
            <div className="border-hairline-soft flex items-center justify-between gap-3 border-b px-5 pt-4 pb-3">
              <h2
                id={`${nameId}-title`}
                className="text-[17px] font-semibold tracking-tight"
              >
                New group
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="text-ink-muted hover:bg-surface-sunken focus-visible:outline-pr grid size-8 cursor-pointer place-items-center rounded-lg focus-visible:outline-2"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>
            <div className="flex flex-col gap-4 px-5 py-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor={nameId} className="text-[12.5px] font-medium">
                  Name
                </label>
                <input
                  id={nameId}
                  name="name"
                  required
                  maxLength={60}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Larkspur Studio"
                  className={`${FIELD} h-[38px] text-[14px]`}
                  {...NOT_A_LOGIN}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={prefixId} className="text-[12.5px] font-medium">
                  Task key prefix
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    id={prefixId}
                    name="prefix"
                    required
                    maxLength={5}
                    value={shown}
                    onChange={(event) => {
                      setTouched(true);
                      setPrefix(
                        event.target.value.toUpperCase().replace(/[^A-Z]/g, ""),
                      );
                    }}
                    aria-describedby={helpId}
                    aria-invalid={shown !== "" && !valid}
                    className={`${FIELD} h-[38px] w-[110px] font-mono text-[14px] tracking-wider uppercase`}
                    {...NOT_A_LOGIN}
                  />
                  <span
                    aria-hidden="true"
                    className="text-ink-muted flex gap-2 font-mono text-[12.5px]"
                  >
                    {valid
                      ? [1, 2, 3].map((number) => (
                          <span
                            key={number}
                            className="bg-surface-sunken rounded px-1.5 py-0.5"
                          >
                            {shown}-{number}
                          </span>
                        ))
                      : null}
                  </span>
                </div>
                <p id={helpId} className="text-ink-muted text-[12px]">
                  2 to 5 letters. Tasks in this group get keys like{" "}
                  <span className="font-mono">{valid ? shown : "LAR"}-12</span>.
                </p>
              </div>
              <p className="bg-surface-raised border-hairline-soft text-ink-soft flex gap-2 rounded-lg border px-3 py-2.5 text-[12.5px] leading-relaxed">
                <Lock
                  aria-hidden="true"
                  className="text-ink-faint mt-0.5 size-3.5 shrink-0"
                />
                The prefix is fixed once the group exists, so links, the search
                and agents keep finding its tasks. You become its owner and can
                invite members next.
              </p>
            </div>
            <div className="border-hairline-soft bg-surface-raised flex justify-end gap-2 border-t px-5 py-3">
              <button type="button" onClick={close} className={SECONDARY}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending || !valid}
                className={PRIMARY}
              >
                {pending ? "Creating…" : "Create group"}
              </button>
            </div>
          </>
        )}
      </GroupForm>
    </dialog>
  );
}
