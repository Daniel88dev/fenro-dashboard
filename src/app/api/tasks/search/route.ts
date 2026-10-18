import { signedInUserQuery } from "@/modules/identity/application/queries/signed-in-user";
import { searchTasksQuery } from "@/modules/tasks/application/queries/search-tasks";
import { getContainer } from "@/shared/infrastructure/container";

// A GET route rather than a server action: the palette asks on every
// keystroke, and server actions queue one behind another and can't be aborted.
export async function GET(request: Request): Promise<Response> {
  const { queryBus } = await getContainer();
  const user = await queryBus.ask(signedInUserQuery());
  if (!user) {
    return Response.json(
      { error: "Sign in with GitHub to search tasks." },
      { status: 401 },
    );
  }

  const params = new URL(request.url).searchParams;
  const search = await queryBus.ask(
    searchTasksQuery(
      user.id,
      params.get("q") ?? "",
      params.get("descriptions") === "1",
    ),
  );
  return Response.json(search, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
