import { describe, expect, it } from "vitest";

import { isErr, unwrap } from "@/shared/domain";

import { ExternalReference } from "./external-reference";
import { parseTaskKey } from "./task-key";
import { RepositoryReference } from "./repository-reference";

describe("ExternalReference", () => {
  it.each([
    [
      "https://github.com/Daniel88dev/fenro-dashboard/issues/12",
      "github-issue",
      "Daniel88dev/fenro-dashboard#12",
    ],
    [
      "https://github.com/Daniel88dev/fenro-dashboard/pull/5/files",
      "github-pull-request",
      "Daniel88dev/fenro-dashboard#5",
    ],
    ["https://acme.atlassian.net/browse/PAY-481", "jira", "PAY-481"],
    ["https://jira.internal.example/browse/OPS-7", "jira", "OPS-7"],
    ["https://linear.app/acme/issue/ENG-42/fix-the-thing", "linear", "ENG-42"],
    ["https://example.com/spec", "url", "https://example.com/spec"],
  ])("recognises %s", (url, system, key) => {
    const reference = unwrap(ExternalReference.fromUrl(url));

    expect(reference.system).toBe(system);
    expect(reference.key).toBe(key);
  });

  it("refuses what is not an http link", () => {
    expect(isErr(ExternalReference.fromUrl("not a url"))).toBe(true);
    expect(isErr(ExternalReference.fromUrl("javascript:alert(1)"))).toBe(true);
  });
});

describe("parseTaskKey", () => {
  it.each(["T-12", "t-12", "#12", "12", " T-12 "])("reads %s", (value) => {
    expect(unwrap(parseTaskKey(value))).toBe(12);
  });

  it.each(["T-0", "T12x", "abc", ""])("refuses %s", (value) => {
    expect(isErr(parseTaskKey(value))).toBe(true);
  });
});

describe("RepositoryReference", () => {
  it("parses owner/name and matches regardless of case", () => {
    const reference = unwrap(
      RepositoryReference.parse("Nordwind/Billing-Core"),
    );

    expect(reference.fullName).toBe("Nordwind/Billing-Core");
    expect(
      reference.matches(
        unwrap(RepositoryReference.parse("nordwind/billing-core")),
      ),
    ).toBe(true);
  });

  it("refuses anything else", () => {
    expect(isErr(RepositoryReference.parse("just-a-name"))).toBe(true);
    expect(isErr(RepositoryReference.parse("a/b/c"))).toBe(true);
  });
});
