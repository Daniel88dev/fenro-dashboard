import { err, ok, type Result } from "@/shared/domain";

import { invalidGroup, type GroupError } from "./errors";

const LOGIN = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

/** GitHub logins are case-insensitive, so they are kept in lower case. */
export function parseGitHubLogin(value: string): Result<string, GroupError> {
  const login = value.trim().replace(/^@/, "");
  if (!LOGIN.test(login)) {
    return err(invalidGroup(`"${login}" is not a GitHub username.`));
  }
  return ok(login.toLowerCase());
}

export function sameLogin(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}
