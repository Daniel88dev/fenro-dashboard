import { beforeEach, describe, expect, it } from "vitest";

import type { Actor } from "@/modules/tasks/domain";
import { HmacUploadTickets } from "@/modules/tasks/infrastructure/hmac-upload-tickets";
import { InMemoryPictureStorage } from "@/modules/tasks/infrastructure/in-memory-picture.storage";
import { InMemoryTaskStore } from "@/modules/tasks/infrastructure/in-memory-task.store";
import { UnconfiguredPictureStorage } from "@/modules/tasks/infrastructure/uploadthing-picture.storage";

import {
  AddPictureHandler,
  UploadPictureHandler,
  type AddPictureCommand,
} from "./commands/add-picture";
import { CreateTaskHandler } from "./commands/create-task";
import { RemovePictureHandler } from "./commands/remove-picture";
import { StartTaskHandler } from "./commands/start-task";
import type { PictureStorage } from "./ports/picture-storage";
import { PictureLinkHandler, pictureLinkQuery } from "./queries/picture";
import {
  PictureUploadTicketHandler,
  UPLOAD_TICKET_TTL_MS,
} from "./queries/picture-upload-ticket";
import { TaskBriefHandler, taskBriefQuery } from "./queries/task-brief";

const OWNER = "user-1";
const DANIEL: Actor = { kind: "human", id: OWNER, name: "Daniel" };
const AGENT: Actor = { kind: "agent", id: "token-1", name: "Claude Code" };
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);

let now: Date;
let store: InMemoryTaskStore;
let storage: InMemoryPictureStorage;
let ids: number;
const clock = () => now;

beforeEach(async () => {
  now = new Date("2026-09-26T10:00:00Z");
  store = new InMemoryTaskStore();
  storage = new InMemoryPictureStorage();
  ids = 0;
  await new CreateTaskHandler(store, store, clock).handle({
    type: "tasks.create-task",
    ownerId: OWNER,
    actor: DANIEL,
    taskId: "00000000-0000-4000-8000-000000000001",
    title: "Redesign sign-in",
  });
});

function pictureId() {
  ids += 1;
  return `00000000-0000-4000-9000-${String(ids).padStart(12, "0")}`;
}

const adder = (to: PictureStorage = storage) =>
  new AddPictureHandler(store, store, to, clock);

const add = (fields: Partial<AddPictureCommand> = {}, to?: PictureStorage) =>
  adder(to).handle({
    type: "tasks.add-picture",
    ownerId: OWNER,
    actor: DANIEL,
    pictureId: pictureId(),
    task: "T-1",
    fileName: "screen.png",
    bytes: PNG,
    ...fields,
  });

async function pictures() {
  const brief = await new TaskBriefHandler(store, clock).handle(
    taskBriefQuery(OWNER, "T-1"),
  );
  if (!brief.ok) throw new Error(brief.error.message);
  return brief.value.pictures;
}

describe("adding a picture", () => {
  it("stores the bytes and lists the picture on its task, oldest first", async () => {
    expect((await add({ fileName: "before" })).ok).toBe(true);
    now = new Date("2026-09-26T10:05:00Z");
    expect((await add({ fileName: "after.PNG" })).ok).toBe(true);

    expect(await pictures()).toMatchObject([
      { name: "before.png", type: "image/png", bytes: PNG.byteLength },
      { name: "after.PNG", addedBy: "Daniel", addedByKind: "human" },
    ]);
    expect(storage.files.size).toBe(2);
  });

  it("notes the session when the adder is working on the task", async () => {
    await new StartTaskHandler(store, clock).handle({
      type: "tasks.start-task",
      ownerId: OWNER,
      actor: AGENT,
      task: "T-1",
    });

    await add({ actor: AGENT });
    await add({ actor: DANIEL });

    expect((await pictures()).map((picture) => picture.session)).toEqual([
      1,
      null,
    ]);
  });

  it("adds a picture sent twice only once", async () => {
    const id = pictureId();
    await add({ pictureId: id });
    expect((await add({ pictureId: id })).ok).toBe(true);

    expect(await pictures()).toHaveLength(1);
    expect(storage.files.size).toBe(1);
  });

  it("refuses what is not a picture, and stores nothing", async () => {
    const refused = await add({
      bytes: new TextEncoder().encode("<svg onload=alert(1)>"),
    });

    expect(!refused.ok && refused.error.code).toBe("invalid-picture");
    expect(storage.files.size).toBe(0);
  });

  it("says so when storage is down, and adds nothing", async () => {
    storage.failNextPut = true;

    const refused = await add();

    expect(!refused.ok && refused.error.code).toBe("pictures-unavailable");
    expect(await pictures()).toEqual([]);
  });

  it("says pictures are off when no store is set up", async () => {
    const refused = await add({}, new UnconfiguredPictureStorage());

    expect(!refused.ok && refused.error.code).toBe("pictures-unavailable");
  });

  it("refuses a task someone else owns", async () => {
    const refused = await add({ ownerId: "user-2" });

    expect(!refused.ok && refused.error.code).toBe("task-not-found");
    expect(storage.files.size).toBe(0);
  });
});

describe("upload links", () => {
  const tickets = new HmacUploadTickets("test-secret");
  const ticket = async (task = "T-1") =>
    new PictureUploadTicketHandler(store, storage, tickets, clock).handle({
      type: "tasks.picture-upload-ticket",
      ownerId: OWNER,
      actor: AGENT,
      task,
      pictureId: "00000000-0000-4000-9000-00000000abcd",
      name: "design.png",
    });
  const upload = (token: string) =>
    new UploadPictureHandler(tickets, adder(), clock).handle({
      type: "tasks.upload-picture",
      ticket: token,
      bytes: PNG,
    });

  it("adds the picture as the agent that asked, when the bytes arrive", async () => {
    const issued = await ticket();
    if (!issued.ok) throw new Error(issued.error.message);
    expect(await pictures()).toEqual([]);

    expect((await upload(issued.value.token)).ok).toBe(true);
    // curl retried: the same link adds nothing more.
    expect((await upload(issued.value.token)).ok).toBe(true);

    expect(await pictures()).toMatchObject([
      {
        id: "00000000-0000-4000-9000-00000000abcd",
        name: "design.png",
        addedBy: "Claude Code",
      },
    ]);
  });

  it("refuses a link that expired or was tampered with", async () => {
    const issued = await ticket();
    if (!issued.ok) throw new Error(issued.error.message);
    const [claims, signature] = issued.value.token.split(".");
    const forged = `${claims}x.${signature}`;
    const late = new Date(now.getTime() + UPLOAD_TICKET_TTL_MS + 1);

    const tampered = await upload(forged);
    now = late;
    const expired = await upload(issued.value.token);

    expect(!tampered.ok && tampered.error.code).toBe("invalid-upload-link");
    expect(!expired.ok && expired.error.code).toBe("invalid-upload-link");
    expect(await pictures()).toEqual([]);
  });

  it("refuses a link from another secret", async () => {
    const issued = await ticket();
    if (!issued.ok) throw new Error(issued.error.message);

    expect(
      new HmacUploadTickets("other-secret").redeem(issued.value.token, now),
    ).toBeNull();
  });

  it("gives no link for a task that is not there", async () => {
    const refused = await ticket("T-9");

    expect(!refused.ok && refused.error.code).toBe("task-not-found");
  });
});

describe("removing and showing a picture", () => {
  it("takes it off the task and out of storage", async () => {
    const id = pictureId();
    await add({ pictureId: id });

    const removed = await new RemovePictureHandler(
      store,
      storage,
      clock,
    ).handle({
      type: "tasks.remove-picture",
      ownerId: OWNER,
      actor: DANIEL,
      picture: id,
    });

    expect(removed.ok).toBe(true);
    expect(await pictures()).toEqual([]);
    expect(storage.files.size).toBe(0);
  });

  it("links only the owner to a picture", async () => {
    const id = pictureId();
    await add({ pictureId: id });
    const links = new PictureLinkHandler(store, storage);

    const mine = await links.handle(pictureLinkQuery(OWNER, id));
    const theirs = await links.handle(pictureLinkQuery("user-2", id));

    expect(mine.ok && mine.value.url).toMatch(/^https:\/\/pictures\.test\//);
    expect(!theirs.ok && theirs.error.code).toBe("picture-not-found");
  });
});
