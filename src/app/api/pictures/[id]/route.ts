import { signedInUserQuery } from "@/modules/identity/application/queries/signed-in-user";
import { pictureLinkQuery } from "@/modules/tasks/application/queries/picture";
import { getContainer } from "@/shared/infrastructure/container";

import { failure, refusal } from "../responses";

/**
 * One of the signed-in person's pictures: a redirect to a short-lived link
 * at the store. Pages point here rather than at the store, so a link on a
 * page never goes stale and nobody else's picture can be named.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/pictures/[id]">,
): Promise<Response> {
  const { id } = await params;
  const { queryBus } = await getContainer();
  const user = await queryBus.ask(signedInUserQuery());
  if (!user) return failure(401, "Sign in with GitHub to see pictures.");

  const link = await queryBus.ask(pictureLinkQuery(user.id, id));
  if (!link.ok) return refusal(link.error);
  return new Response(null, {
    status: 307,
    headers: {
      location: link.value.url,
      // The link inside lasts an hour; the browser may reuse it for less.
      "cache-control": "private, max-age=600",
    },
  });
}
