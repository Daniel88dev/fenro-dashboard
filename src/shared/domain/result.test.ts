import { describe, expect, it } from "vitest";

import { err, isErr, isOk, map, ok, unwrap } from "./result";

describe("Result", () => {
  it("carries the value of a success", () => {
    const result = ok(42);

    expect(isOk(result)).toBe(true);
    expect(unwrap(result)).toBe(42);
  });

  it("carries the error of a failure", () => {
    const result = err(new Error("boom"));

    expect(isErr(result)).toBe(true);
    expect(() => unwrap(result)).toThrow("boom");
  });

  it("maps over a success and leaves a failure untouched", () => {
    expect(map(ok(2), (n) => n * 2)).toEqual(ok(4));

    const failure = err("nope");
    expect(map(failure, (n: number) => n * 2)).toBe(failure);
  });
});
