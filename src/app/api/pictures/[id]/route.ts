import { signedInUserQuery } from "@/modules/identity/application/queries/signed-in-user";
import { pictureContentQuery } from "@/modules/tasks/application/queries/picture";
import { getContainer } from "@/shared/infrastructure/container";

import { spacesOf } from "../../../tasks/spaces";
import { failure, refusal } from "../responses";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/pictures/[id]">,
): Promise<Response> {
  const { id } = await params;
  const { queryBus } = await getContainer();
  const user = await queryBus.ask(signedInUserQuery());
  if (!user) return failure(401, "Sign in with GitHub to see pictures.");

  // A picture id names no space, so each space of yours is asked in turn.
  const { all } = await spacesOf(queryBus, user);
  let picture = await queryBus.ask(pictureContentQuery(all[0]!.ownerId, id));
  for (const space of all.slice(1)) {
    if (picture.ok) break;
    picture = await queryBus.ask(pictureContentQuery(space.ownerId, id));
  }
  if (!picture.ok) return refusal(picture.error);
  return new Response(picture.value.bytes as Uint8Array<ArrayBuffer>, {
    headers: {
      "content-type": picture.value.type,
      "content-length": String(picture.value.bytes.byteLength),
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(picture.value.name)}`,
      // A picture is never edited, so the browser keeps its copy; private so no
      // shared cache holds it.
      "cache-control": "private, max-age=604800, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
