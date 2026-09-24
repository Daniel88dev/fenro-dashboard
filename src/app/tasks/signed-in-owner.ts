import { signedInUserQuery } from "@/modules/identity/application/queries/signed-in-user";
import { getContainer } from "@/shared/infrastructure/container";

/** The container for this request and whose tasks it shows, if anyone's. */
export async function tasksContext(now?: Date) {
  const container = await getContainer(now);
  const user = await container.queryBus.ask(signedInUserQuery());
  return { container, ownerId: user?.id ?? null };
}
