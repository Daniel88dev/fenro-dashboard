"use server";

import { revalidatePath } from "next/cache";

import { unwatchRepositoryCommand } from "@/modules/github-insights/application/commands/unwatch-repository";
import { watchRepositoryCommand } from "@/modules/github-insights/application/commands/watch-repository";
import { repositoryRowsQuery } from "@/modules/github-insights/application/queries/repository-rows";
import { RepositoryCoordinates } from "@/modules/github-insights/domain";
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
  const { owner, name, fullName } = coordinates.value;

  const rows = await queryBus.ask(repositoryRowsQuery());
  if (
    isOk(rows) &&
    rows.value.some((row) => row.owner === owner && row.name === name)
  ) {
    return { error: `You are already watching ${fullName}.` };
  }

  await commandBus.dispatch(watchRepositoryCommand(owner, name));
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

  const { commandBus } = await getContainer();
  await commandBus.dispatch(
    unwatchRepositoryCommand(coordinates.value.owner, coordinates.value.name),
  );
  revalidatePath("/repositories");
}
