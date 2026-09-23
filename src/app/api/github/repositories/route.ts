import { watchableRepositoriesQuery } from "@/modules/github-insights/application/queries/watchable-repositories";
import type { PickerListing } from "@/modules/github-insights/ui/add-repositories";
import { signedInUserQuery } from "@/modules/identity/application/queries/signed-in-user";
import { isErr } from "@/shared/domain";
import { getContainer } from "@/shared/infrastructure/container";

/**
 * The repositories the picker offers. A route handler rather than a server
 * action because it only reads, and server actions queue behind each other: a
 * sync already running would hold the list up.
 */
export async function GET(): Promise<Response> {
  const { queryBus } = await getContainer();
  const user = await queryBus.ask(signedInUserQuery());
  if (!user) {
    return listing(
      { error: "Sign in with GitHub to list your repositories." },
      401,
    );
  }

  const result = await queryBus.ask(watchableRepositoriesQuery(user.id));
  if (isErr(result)) return listing({ error: result.error.message }, 502);

  return listing({
    repositories: result.value.map(
      ({ owner, name, isPrivate, description, watched }) => ({
        owner,
        name,
        isPrivate,
        description,
        watched,
      }),
    ),
  });
}

function listing(body: PickerListing, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "private, no-store" },
  });
}
