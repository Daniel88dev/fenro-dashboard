"use server";

import { refresh, revalidatePath } from "next/cache";

import { syncWatchedRepositoriesCommand } from "@/modules/github-insights/application/commands/sync-watched-repositories";
import { unwatchRepositoryCommand } from "@/modules/github-insights/application/commands/unwatch-repository";
import { watchRepositoryCommand } from "@/modules/github-insights/application/commands/watch-repository";
import { watchableRepositoriesQuery } from "@/modules/github-insights/application/queries/watchable-repositories";
import {
  RepositoryCoordinates,
  type SyncTrigger,
} from "@/modules/github-insights/domain";
import { signedInUserQuery } from "@/modules/identity/application/queries/signed-in-user";
import type { AddRepositoriesState } from "@/modules/github-insights/ui/add-repositories";
import { isErr } from "@/shared/domain";
import { getContainer } from "@/shared/infrastructure/container";

/** How many repositories one submission may add. */
const ADD_LIMIT = 100;

/**
 * Thin, as the working agreement asks: parse the input, ask a query, dispatch
 * commands, map the result to something the picker can render. Only
 * repositories GitHub lists for this viewer are watched, whatever the form
 * posted, and each is stored as GitHub spells it.
 */
export async function addRepositoriesAction(
  _state: AddRepositoriesState,
  formData: FormData,
): Promise<AddRepositoriesState> {
  const picked = formData
    .getAll("repository")
    .map((value) => String(value).toLowerCase());
  if (picked.length === 0) {
    return { error: "Pick at least one repository.", added: 0 };
  }
  if (picked.length > ADD_LIMIT) {
    return {
      error: `Add at most ${ADD_LIMIT} repositories at a time.`,
      added: 0,
    };
  }

  const { commandBus, queryBus } = await getContainer();
  // A server action is a public endpoint whether or not the page showed the
  // picker, so it checks for itself.
  const user = await queryBus.ask(signedInUserQuery());
  if (!user) {
    return { error: "Sign in with GitHub to add repositories.", added: 0 };
  }

  const listed = await queryBus.ask(watchableRepositoriesQuery(user.id));
  if (isErr(listed)) return { error: listed.error.message, added: 0 };

  const wanted = new Set(picked);
  const toWatch = listed.value.filter(
    (repository) =>
      !repository.watched &&
      wanted.has(`${repository.owner}/${repository.name}`.toLowerCase()),
  );
  for (const repository of toWatch) {
    await commandBus.dispatch(
      watchRepositoryCommand(user.id, repository.owner, repository.name),
    );
  }

  revalidatePath("/repositories");
  return { error: null, added: toWatch.length };
}

export async function unwatchRepositoryAction(
  formData: FormData,
): Promise<void> {
  const owner = String(formData.get("owner") ?? "");
  const name = String(formData.get("name") ?? "");

  const coordinates = RepositoryCoordinates.create(owner, name);
  if (isErr(coordinates)) return;

  const { commandBus, queryBus } = await getContainer();
  const user = await queryBus.ask(signedInUserQuery());
  if (!user) return;

  await commandBus.dispatch(
    unwatchRepositoryCommand(
      user.id,
      coordinates.value.owner,
      coordinates.value.name,
    ),
  );
  revalidatePath("/repositories");
}

const TRIGGERS: readonly SyncTrigger[] = ["manual", "automatic"];

/**
 * Refresh, pressed or started by a stale page. The client only says which;
 * the watched repositories' sync policy decides what is actually read from
 * GitHub, with a token that never leaves the server. `refresh()` sends the
 * page, re-rendered from the database, back in the same response.
 */
export async function syncRepositoriesAction(
  trigger: SyncTrigger,
): Promise<void> {
  if (!TRIGGERS.includes(trigger)) return;

  const { commandBus, queryBus } = await getContainer();
  const user = await queryBus.ask(signedInUserQuery());
  if (!user) return;

  await commandBus.dispatch(syncWatchedRepositoriesCommand(user.id, trigger));
  refresh();
}
