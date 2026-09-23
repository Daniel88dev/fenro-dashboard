import type {
  Authenticator,
  SignedInUser,
} from "@/modules/identity/application/ports/authenticator";
import type { Query, QueryHandler } from "@/shared/application";

/** `null` is an answer, not a failure: being signed out is a normal state. */
export type SignedInUserQuery = Query<
  "identity.signed-in-user",
  SignedInUser | null
>;

export function signedInUserQuery(): SignedInUserQuery {
  return { type: "identity.signed-in-user" };
}

export class SignedInUserHandler implements QueryHandler<
  SignedInUserQuery,
  SignedInUser | null
> {
  constructor(private readonly authenticator: Authenticator) {}

  handle(): Promise<SignedInUser | null> {
    return this.authenticator.signedInUser();
  }
}
