import { MAX_PICTURE_BYTES, type TaskError } from "@/modules/tasks/domain";

/**
 * A picture's bytes from a request body. A body announcing more than the
 * limit is turned away before it is read; one that does not say is read, and
 * the domain measures it.
 */
export async function pictureBytes(
  request: Request,
): Promise<Uint8Array | Response> {
  const announced = Number(request.headers.get("content-length") ?? "0");
  if (announced > MAX_PICTURE_BYTES) {
    return failure(
      413,
      "The picture is larger than 4 MB. Save it smaller and try again.",
    );
  }
  return new Uint8Array(await request.arrayBuffer());
}

const STATUS: Partial<Record<TaskError["code"], number>> = {
  "task-not-found": 404,
  "picture-not-found": 404,
  "invalid-picture": 422,
  "invalid-upload-link": 403,
  "pictures-unavailable": 503,
};

export function refusal(error: TaskError): Response {
  return failure(STATUS[error.code] ?? 400, error.message, error.code);
}

export function failure(status: number, message: string, code?: string) {
  return Response.json(
    { error: message, ...(code ? { code } : {}) },
    { status, headers: { "cache-control": "no-store" } },
  );
}
