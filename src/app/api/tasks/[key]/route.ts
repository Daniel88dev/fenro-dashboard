import { signedInUserQuery } from "@/modules/identity/application/queries/signed-in-user";
import { listLabelsQuery } from "@/modules/tasks/application/queries/list-labels";
import { taskBriefQuery } from "@/modules/tasks/application/queries/task-brief";
import type { TaskDialogView } from "@/modules/tasks/ui/task-dialogs";
import {
  getContainer,
  picturesEnabled,
} from "@/shared/infrastructure/container";

import { spacesOf } from "../../../tasks/spaces";

const JOURNAL_LIMIT = 20;

// A GET route rather than a server action: the dialog asks for a task on hover,
// before the click, and server actions queue one behind another.
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/tasks/[key]">,
): Promise<Response> {
  const { queryBus } = await getContainer();
  const user = await queryBus.ask(signedInUserQuery());
  if (!user) {
    return Response.json(
      { error: "Sign in with GitHub to see this task." },
      { status: 401 },
    );
  }

  const key = decodeURIComponent((await params).key);
  const spaces = await spacesOf(queryBus, user);
  const ownerId = spaces.ownerOf(key);
  const [task, labels] = await Promise.all([
    queryBus.ask(
      taskBriefQuery(ownerId, key, JOURNAL_LIMIT, {
        readerId: spaces.personal.ownerId,
      }),
    ),
    queryBus.ask(listLabelsQuery(ownerId)),
  ]);
  if (!task.ok) {
    return Response.json({ error: `No task ${key}.` }, { status: 404 });
  }

  const view: TaskDialogView = {
    task: task.value,
    labels,
    you: { id: user.id, login: user.githubLogin },
    picturesEnabled: picturesEnabled(),
  };
  return Response.json(view, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
