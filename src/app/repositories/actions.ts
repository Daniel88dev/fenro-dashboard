"use server";

import { refresh, revalidatePath } from "next/cache";

import { syncWatchedRepositoriesCommand } from "@/modules/github-insights/application/commands/sync-watched-repositories";
import { unwatchRepositoryCommand } from "@/modules/github-insights/application/commands/unwatch-repository";
import { watchRepositoryCommand } from "@/modules/github-insights/application/commands/watch-repository";
import { lookUpRepositoryQuery } from "@/modules/github-insights/application/queries/look-up-repository";
import { repositoryRowsQuery } from "@/modules/github-insights/application/queries/repository-rows";
import {
  RepositoryCoordinates,
  type SyncTrigger,
} from "@/modules/github-insights/domain";
import { signedInUserQuery } from "@/modules/identity/application/queries/signed-in-user";
import type { WatchFormState } from "@/modules/github-insights/ui/watch-repository-form";
import { isErr, isOk } from "@/shared/domain";
import { getContainer } from "@/shared/infrastructure/container";

/**
 * Thin, as the working agreement asks: parse the input, ask a query, dispatch a
 * command, map the result to something the form can render. The rule that one
 * repository is watched once is the handler's; the message explaining it is
 * this layer's.
 */
export async function watchRepositoryAction(
  _state: WatchFormState,
  formData: FormData,
): Promise<WatchFormState> {
  const raw = String(formData.get("repository") ?? "");

  const coordinates = RepositoryCoordinates.parse(raw);
  if (isErr(coordinates)) {
    return { error: coordinates.error.message };
  }

  const { commandBus, queryBus } = await getContainer();
  // A server action is a public endpoint whether or not the page showed the
  // form, so it checks for itself.
  const user = await queryBus.ask(signedInUserQuery());
  if (!user) {
    return { error: "Sign in with GitHub to watch a repository." };
  }
  const watcher = { id: user.id, login: user.githubLogin };

  const rows = await queryBus.ask(repositoryRowsQuery(watcher));
  const typed = coordinates.value;
  if (
    isOk(rows) &&
    rows.value.some(
      (row) =>
        row.owner.toLowerCase() === typed.owner.toLowerCase() &&
        row.name.toLowerCase() === typed.name.toLowerCase(),
    )
  ) {
    return { error: `You are already watching ${typed.fullName}.` };
  }

  // Ask GitHub before watching, so a typo fails here rather than on every
  // sync, and the name is stored as GitHub spells it. If GitHub is down the
  // watch goes ahead: the first sync will say so on the row.
  const found = await queryBus.ask(
    lookUpRepositoryQuery(typed.owner, typed.name),
  );
  if (isErr(found) && found.error.code !== "github-unavailable") {
    return { error: found.error.message };
  }
  const { owner, name } = isOk(found) ? found.value : typed;

  await commandBus.dispatch(watchRepositoryCommand(user.id, owner, name));
  revalidatePath("/repositories");
  return { error: null };
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
