import { describe, expect, it } from "vitest";

import type { Person } from "@/modules/groups/domain";
import { InMemoryGroupStore } from "@/modules/groups/infrastructure/in-memory-group.store";

import {
  CreateGroupHandler,
  createGroupCommand,
} from "./commands/create-group";
import { DeleteGroupHandler } from "./commands/delete-group";
import {
  AcceptInvitationHandler,
  InviteMemberHandler,
} from "./commands/membership-commands";
import { MyGroupsHandler, myGroupsQuery } from "./queries/my-groups";
import { GroupHandler, groupQuery } from "./queries/group";

const clock = () => new Date("2026-10-19T12:00:00Z");
const daniel: Person = { id: "user-daniel", login: "daniel88dev" };
const ana: Person = { id: "user-ana", login: "ana-k" };

function setUp(taskCount = 0) {
  const store = new InMemoryGroupStore();
  const tasks = {
    summary: async () => ({ count: taskCount, nextNumber: taskCount + 1 }),
  };
  return {
    store,
    create: new CreateGroupHandler(store, clock),
    invite: new InviteMemberHandler(store, clock),
    accept: new AcceptInvitationHandler(store, clock),
    remove: new DeleteGroupHandler(store, tasks),
    mine: new MyGroupsHandler(store),
    detail: new GroupHandler(store, tasks),
  };
}

const createHal = (by: Person = daniel, prefix = "HAL", id = "org-hal") =>
  createGroupCommand({
    groupId: id,
    name: "Halcyon Labs",
    prefix,
    by,
  });

describe("group handlers", () => {
  it("refuses a prefix another group uses", async () => {
    const { create } = setUp();
    await create.handle(createHal());

    const second = await create.handle(createHal(ana, "hal", "org-other"));

    expect(second.ok || second.error.code).toBe("prefix-taken");
  });

  it("shows an invitation until it is accepted", async () => {
    const { create, invite, accept, mine } = setUp();
    await create.handle(createHal());
    await invite.handle({
      type: "groups.invite-member",
      groupId: "org-hal",
      by: daniel,
      login: "Ana-K",
    });

    const before = await mine.handle(myGroupsQuery(ana));
    const accepted = await accept.handle({
      type: "groups.accept-invitation",
      groupId: "org-hal",
      by: ana,
    });
    const after = await mine.handle(myGroupsQuery(ana));

    expect(before.invitations.map((i) => i.prefix)).toEqual(["HAL"]);
    expect(accepted.ok).toBe(true);
    expect(after.invitations).toEqual([]);
    expect(after.groups).toMatchObject([
      { prefix: "HAL", role: "member", members: 2 },
    ]);
  });

  it("hides a group from someone outside it", async () => {
    const { create, invite, detail } = setUp();
    await create.handle(createHal());

    const invited = await invite.handle({
      type: "groups.invite-member",
      groupId: "org-hal",
      by: ana,
      login: "someone",
    });
    const read = await detail.handle(groupQuery("hal", ana.id));

    expect(invited.ok || invited.error.code).toBe("group-not-found");
    expect(read.ok || read.error.code).toBe("group-not-found");
  });

  it("deletes only a group without tasks", async () => {
    const empty = setUp();
    const busy = setUp(3);
    for (const { create } of [empty, busy]) await create.handle(createHal());
    const command = {
      type: "groups.delete-group",
      groupId: "org-hal",
      by: daniel,
    } as const;

    const refused = await busy.remove.handle(command);
    const deleted = await empty.remove.handle(command);

    expect(refused.ok || refused.error.code).toBe("group-has-tasks");
    expect(deleted.ok).toBe(true);
    expect(await empty.store.findById("org-hal")).toBeUndefined();
  });
});
