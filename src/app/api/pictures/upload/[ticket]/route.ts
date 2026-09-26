import type { UploadPictureCommand } from "@/modules/tasks/application/commands/add-picture";
import { getAgentContainer } from "@/shared/infrastructure/container";

import { pictureBytes, refusal } from "../../responses";

/**
 * Where an agent sends a picture's bytes, with the link attach_picture gave
 * it: `curl -T design.png <link>`. The signed ticket in the path says who is
 * adding what to which task, so no other credential is needed.
 */
async function upload(
  request: Request,
  { params }: RouteContext<"/api/pictures/upload/[ticket]">,
): Promise<Response> {
  const { ticket } = await params;
  const bytes = await pictureBytes(request);
  if (bytes instanceof Response) return bytes;

  const command: UploadPictureCommand = {
    type: "tasks.upload-picture",
    ticket,
    bytes,
  };
  const added = await getAgentContainer().commandBus.dispatch(command);
  if (!added.ok) return refusal(added.error);
  return Response.json(
    { added: true, message: "The picture is on the task." },
    { status: 201 },
  );
}

export { upload as POST, upload as PUT };
