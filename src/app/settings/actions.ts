"use server";

import { revalidatePath } from "next/cache";

import { issueAccessTokenCommand } from "@/modules/identity/application/commands/issue-access-token";
import { revokeAccessTokenCommand } from "@/modules/identity/application/commands/revoke-access-token";
import { signedInUserQuery } from "@/modules/identity/application/queries/signed-in-user";
import { generateAccessTokenSecret } from "@/modules/identity/domain";
import type { IssueTokenState } from "@/modules/identity/ui/agent-access";
import { isErr } from "@/shared/domain";
import { getContainer } from "@/shared/infrastructure/container";

/**
 * The secret is made here rather than in the command so the command can stay
 * a command: it returns nothing, and the action is the one place that ever
 * holds the plain secret, just long enough to show it once.
 */
export async function issueAccessTokenAction(
  _state: IssueTokenState,
  formData: FormData,
): Promise<IssueTokenState> {
  const { commandBus, queryBus } = await getContainer();
  const user = await queryBus.ask(signedInUserQuery());
  if (!user) {
    return { error: "Sign in with GitHub to create a token.", issued: null };
  }

  const name = String(formData.get("name") ?? "");
  const secret = generateAccessTokenSecret();
  const issued = await commandBus.dispatch(
    issueAccessTokenCommand({
      tokenId: crypto.randomUUID(),
      ownerId: user.id,
      name,
      scopes:
        formData.get("write") === "on"
          ? ["tasks:read", "tasks:write"]
          : ["tasks:read"],
      lifetimeDays: Number(formData.get("lifetimeDays")),
      secret,
    }),
  );
  if (isErr(issued)) return { error: issued.error.message, issued: null };

  revalidatePath("/settings");
  return { error: null, issued: { name: name.trim(), secret } };
}

export async function revokeAccessTokenAction(
  formData: FormData,
): Promise<void> {
  const tokenId = String(formData.get("tokenId") ?? "");
  if (!tokenId) return;

  const { commandBus, queryBus } = await getContainer();
  const user = await queryBus.ask(signedInUserQuery());
  if (!user) return;

  await commandBus.dispatch(revokeAccessTokenCommand(user.id, tokenId));
  revalidatePath("/settings");
}
