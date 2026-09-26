import type { AddPictureCommand } from "@/modules/tasks/application/commands/add-picture";
import { signedInUserQuery } from "@/modules/identity/application/queries/signed-in-user";
import { getContainer } from "@/shared/infrastructure/container";

import { failure, pictureBytes, refusal } from "../../../pictures/responses";

/**
 * A person adding a picture to a task from the task page: the file's bytes
 * as the body, its name in `?name=`. A route handler rather than a server
 * action, so the browser can show the upload's progress.
 */
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/tasks/[key]/pictures">,
): Promise<Response> {
  const { key } = await params;
  const { commandBus, queryBus } = await getContainer();
  const user = await queryBus.ask(signedInUserQuery());
  if (!user) return failure(401, "Sign in with GitHub to add pictures.");

  const bytes = await pictureBytes(request);
  if (bytes instanceof Response) return bytes;

  const pictureId = crypto.randomUUID();
  const command: AddPictureCommand = {
    type: "tasks.add-picture",
    ownerId: user.id,
    actor: { kind: "human", id: user.id, name: user.githubLogin },
    pictureId,
    task: decodeURIComponent(key),
    fileName: new URL(request.url).searchParams.get("name") ?? "picture",
    bytes,
  };
  const added = await commandBus.dispatch(command);
  if (!added.ok) return refusal(added.error);
  return Response.json({ id: pictureId }, { status: 201 });
}
