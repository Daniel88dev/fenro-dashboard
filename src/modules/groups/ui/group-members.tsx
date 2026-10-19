"use client";

import { CaretRight, UserPlus } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { useId } from "react";

import type { GroupDetail } from "@/modules/groups/application/queries/group";

import type { GroupAction } from "./group-form-state";
import {
  DANGER,
  FIELD,
  GroupForm,
  NOT_A_LOGIN,
  PRIMARY,
  SECONDARY,
} from "./group-form";
import { PrefixBadge } from "./groups-section";

export type GroupMemberActions = {
  readonly invite: GroupAction;
  readonly cancelInvitation: GroupAction;
  readonly changeRole: GroupAction;
  readonly remove: GroupAction;
  readonly delete: GroupAction;
};

const DATE = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const CARD =
  "border-hairline bg-surface flex flex-col gap-2 rounded-xl border p-4 sm:p-[18px]";

export function GroupMembers({
  group,
  you,
  actions,
}: {
  group: GroupDetail;
  you: string;
  actions: GroupMemberActions;
}) {
  const owner = group.yourRole === "owner";
  const owners = group.members.filter((member) => member.role === "owner");
  const lastOwner = owner && owners.length === 1;
  const fields = { group: group.id, prefix: group.prefix };
  const inviteId = useId();
  const tasks = group.tasks.count;

  return (
    <div className="flex max-w-[1080px] flex-col gap-6">
      <header className="flex flex-col gap-2">
        <nav
          aria-label="Breadcrumb"
          className="text-ink-muted flex items-center gap-1.5 text-[12.5px]"
        >
          <Link href="/settings#groups" className="hover:text-ink">
            Settings
          </Link>
          <CaretRight aria-hidden="true" className="size-[11px]" />
          <span>Groups</span>
        </nav>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h1 className="text-ink text-[24px] leading-tight font-semibold tracking-tight">
            {group.name}
          </h1>
          <PrefixBadge prefix={group.prefix} />
          <span className="text-ink-muted text-[13px]">
            {owner ? "You are an owner" : "You are a member"}
          </span>
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section
          aria-labelledby="members-heading"
          className="flex flex-col gap-3"
        >
          <h2
            id="members-heading"
            className="text-ink flex items-baseline gap-2 text-[16px] font-semibold tracking-tight"
          >
            Members
            <span className="text-ink-faint font-mono text-[12.5px] font-normal">
              {group.members.length}
            </span>
          </h2>

          {owner ? (
            <GroupForm
              action={actions.invite}
              label="Invite a member"
              fields={fields}
              resetOnSave
              className="flex flex-wrap gap-2"
            >
              {(pending) => (
                <>
                  <label
                    htmlFor={inviteId}
                    className={`${FIELD} flex h-[34px] min-w-[200px] flex-1 items-center gap-1.5 focus-within:outline-2 focus-within:outline-offset-1`}
                  >
                    <span aria-hidden="true" className="text-ink-faint">
                      @
                    </span>
                    <span className="sr-only">GitHub username to invite</span>
                    <input
                      id={inviteId}
                      name="login"
                      required
                      maxLength={39}
                      placeholder="GitHub username"
                      className="text-ink placeholder:text-ink-faint min-w-0 flex-1 bg-transparent font-mono text-[13px] outline-none"
                      {...NOT_A_LOGIN}
                    />
                  </label>
                  <button type="submit" disabled={pending} className={PRIMARY}>
                    <UserPlus aria-hidden="true" className="size-[15px]" />
                    Invite
                  </button>
                </>
              )}
            </GroupForm>
          ) : null}

          <ul className="border-hairline bg-surface divide-hairline-soft m-0 list-none divide-y overflow-hidden rounded-xl border p-0">
            {group.members.map((member) => {
              const yourself = member.userId === you;
              const canRemove = yourself
                ? !(lastOwner && member.role === "owner")
                : owner;
              return (
                <li
                  key={member.userId}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-[18px]"
                >
                  <Initial login={member.login} />
                  <span className="flex min-w-[140px] flex-1 flex-col gap-0.5">
                    <span className="text-ink font-mono text-[13.5px]">
                      {member.login}
                      {yourself ? (
                        <span className="text-ink-muted font-sans"> (you)</span>
                      ) : null}
                    </span>
                    <span className="text-ink-muted text-[12px]">
                      Joined {DATE.format(member.joinedAt)}
                    </span>
                  </span>
                  {owner ? (
                    <GroupForm
                      action={actions.changeRole}
                      label={`Role of ${member.login}`}
                      fields={{ ...fields, user: member.userId }}
                      className="contents"
                    >
                      {(pending) => (
                        <label className="flex items-center">
                          <span className="sr-only">
                            Role of {member.login}
                          </span>
                          <select
                            name="role"
                            defaultValue={member.role}
                            disabled={pending}
                            onChange={(event) =>
                              event.currentTarget.form?.requestSubmit()
                            }
                            className={`${FIELD} h-[30px] px-2 text-[12.5px]`}
                          >
                            <option value="owner">Owner</option>
                            <option value="member">Member</option>
                          </select>
                        </label>
                      )}
                    </GroupForm>
                  ) : (
                    <span className="text-ink-muted text-[12.5px]">
                      {member.role === "owner" ? "Owner" : "Member"}
                    </span>
                  )}
                  {canRemove ? (
                    <GroupForm
                      action={actions.remove}
                      label={
                        yourself ? "Leave the group" : `Remove ${member.login}`
                      }
                      fields={{ ...fields, user: member.userId }}
                      className="contents"
                    >
                      {(pending) => (
                        <button
                          type="submit"
                          disabled={pending}
                          className={`${SECONDARY} h-[30px]`}
                        >
                          {yourself ? "Leave" : "Remove"}
                        </button>
                      )}
                    </GroupForm>
                  ) : null}
                </li>
              );
            })}
            {group.invitations.map((invitation) => (
              <li
                key={invitation.login}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-[18px]"
              >
                <Initial login={invitation.login} dashed />
                <span className="flex min-w-[140px] flex-1 flex-col gap-0.5">
                  <span className="text-ink-soft font-mono text-[13.5px]">
                    {invitation.login}
                  </span>
                  <span className="text-ink-muted text-[12px]">
                    Invited by {invitation.invitedByLogin} on{" "}
                    {DATE.format(invitation.invitedAt)}. They join from Settings
                    after signing in.
                  </span>
                </span>
                {owner ? (
                  <GroupForm
                    action={actions.cancelInvitation}
                    label={`Cancel the invitation to ${invitation.login}`}
                    fields={{ ...fields, login: invitation.login }}
                    className="contents"
                  >
                    {(pending) => (
                      <button
                        type="submit"
                        disabled={pending}
                        className={`${SECONDARY} h-[30px]`}
                      >
                        Cancel invite
                      </button>
                    )}
                  </GroupForm>
                ) : (
                  <span className="text-ink-muted text-[12.5px]">Invited</span>
                )}
              </li>
            ))}
          </ul>
        </section>

        <div className="flex flex-col gap-4">
          <section aria-labelledby="keys-heading" className={CARD}>
            <h2
              id="keys-heading"
              className="text-ink text-[14px] font-semibold"
            >
              Task keys
            </h2>
            <p className="text-ink-soft text-[13px]">
              Prefix{" "}
              <span className="font-mono font-semibold">{group.prefix}</span>,
              next task{" "}
              <span className="font-mono font-semibold">
                {group.prefix}-{group.tasks.nextNumber}
              </span>
            </p>
            <p className="text-ink-muted text-[12.5px]">
              {tasks === 1 ? "1 task" : `${tasks} tasks`}.{" "}
              <Link
                href={`/tasks?spaces=${group.prefix}`}
                className="hover:text-ink underline underline-offset-2"
              >
                Show them
              </Link>
            </p>
          </section>
          <section aria-labelledby="shared-heading" className={CARD}>
            <h2
              id="shared-heading"
              className="text-ink text-[14px] font-semibold"
            >
              Shared with members
            </h2>
            <p className="text-ink-muted text-[12.5px] leading-relaxed">
              Tasks, epics and labels. Agents using a member&apos;s token can
              work on these tasks, and the journal names the member whose token
              it was.
            </p>
          </section>
          <section aria-labelledby="leave-heading" className={CARD}>
            <h2
              id="leave-heading"
              className="text-ink text-[14px] font-semibold"
            >
              {owner ? "Leave or delete" : "Leave"}
            </h2>
            <p className="text-ink-muted text-[12.5px] leading-relaxed">
              {lastOwner
                ? "You are the only owner, so you cannot leave. Make someone else an owner first."
                : "Leaving keeps the group's tasks for the other members."}{" "}
              {owner
                ? tasks > 0
                  ? "A group can be deleted once it holds no tasks."
                  : "Deleting removes the group for every member."
                : null}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <GroupForm
                action={actions.remove}
                label="Leave the group"
                fields={{ ...fields, user: you }}
                className="contents"
              >
                {(pending) => (
                  <button
                    type="submit"
                    disabled={pending || lastOwner}
                    className={SECONDARY}
                  >
                    Leave group
                  </button>
                )}
              </GroupForm>
              {owner ? (
                <GroupForm
                  action={actions.delete}
                  label="Delete the group"
                  fields={fields}
                  className="flex flex-wrap gap-2"
                >
                  {(pending) => (
                    <button
                      type="submit"
                      disabled={pending || tasks > 0}
                      onClick={(event) => {
                        if (
                          !confirm(`Delete ${group.name} for every member?`)
                        ) {
                          event.preventDefault();
                        }
                      }}
                      className={DANGER}
                    >
                      Delete group
                    </button>
                  )}
                </GroupForm>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Initial({
  login,
  dashed = false,
}: {
  login: string;
  dashed?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`text-ink-soft grid size-8 shrink-0 place-items-center rounded-full font-mono text-[13px] font-semibold uppercase ${
        dashed ? "border-hairline border border-dashed" : "bg-neutral-wash"
      }`}
    >
      {login.slice(0, 1)}
    </span>
  );
}
