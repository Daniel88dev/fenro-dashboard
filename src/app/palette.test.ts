import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The design doc asks for 4.5:1 on every pair a reader has to read, and its own
 * note says `#9A9AA0` does not clear it. These are the pairs the screen
 * actually renders, checked against the stylesheet rather than against a copy
 * of the values, so darkening a token in one scheme and forgetting the other
 * fails here.
 */

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

const DARK_AT = css.indexOf("@media (prefers-color-scheme: dark)");

function tokens(source: string): Record<string, string> {
  const found: Record<string, string> = {};
  for (const [, name, value] of source.matchAll(
    /--color-([a-z-]+):\s*(#[0-9a-f]{6})/g,
  )) {
    found[name!] = value!;
  }
  return found;
}

const light = tokens(css.slice(0, DARK_AT));
const dark = { ...light, ...tokens(css.slice(DARK_AT)) };

function luminance(hex: string): number {
  const channels = [1, 3, 5].map(
    (at) => parseInt(hex.slice(at, at + 2), 16) / 255,
  );
  const [r, g, b] = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(one: string, other: string): number {
  const [lighter, darker] = [luminance(one), luminance(other)].sort(
    (a, b) => b - a,
  );
  return (lighter! + 0.05) / (darker! + 0.05);
}

/** background, foreground, and where the reader meets it. */
const READABLE_PAIRS: readonly [string, string, string][] = [
  ["surface", "ink", "a repository name in a row"],
  ["surface", "ink-muted", "a hint under a count"],
  ["surface", "ink-faint", "a pull request number, a SHA, a duration"],
  ["surface", "pr", "a passing check"],
  ["surface", "issue", "a failing check"],
  ["surface", "running", "a check still running"],
  ["surface-raised", "ink", "a panel's title"],
  ["surface-raised", "ink-muted", "a panel's summary line"],
  ["ground", "ink", "the page heading"],
  ["ground", "ink-muted", "the watched-repository count"],
  ["pr-wash", "pr-strong", "a review-state chip that is settled"],
  ["issue-wash", "issue-strong", "a review-state chip that wants you"],
  ["neutral-wash", "ink-soft", "a draft chip"],
  ["surface", "ink-soft", "an issue filter chip that is not pressed"],
  ["surface", "issue-strong", "a row whose last sync failed"],
  ["ground", "issue-strong", "the header saying the rate limit ran out"],
  ["bar", "bar-ink", "the product name in the top bar"],
  ["bar", "bar-ink-muted", "a nav item that is not the current page"],
  ["ink", "ground", "the label on the primary button"],
  ["pr", "on-pr", "the letter in the brand mark"],
  ["ground", "ink-soft", "a quoted line in a task description"],
  ["ground", "pr-strong", "a link in a task description"],
  ["surface", "pr-strong", "a link in a task dialog"],
  ["neutral-wash", "ink", "inline code in a task description"],
  ["surface-sunken", "ink", "a code block in a task description"],
];

/**
 * Surfaces that must not collapse into one another. The step is deliberately
 * faint — the panel tint the prototype drew is barely off white — so this only
 * catches a token that has become another token, not a design opinion.
 */
const DISTINCT_PAIRS: readonly [string, string][] = [
  ["ground", "surface"],
  ["surface", "surface-raised"],
  ["surface", "hairline"],
];

describe.each([
  ["light", light],
  ["dark", dark],
])("the %s palette", (_scheme, palette) => {
  it("defines every token the components use", () => {
    for (const name of [
      ...new Set(READABLE_PAIRS.flatMap(([bg, fg]) => [bg, fg])),
    ]) {
      expect(palette[name], `--color-${name}`).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it.each(READABLE_PAIRS)(
    "reads %s/%s at 4.5:1 or better — %s",
    (background, foreground) => {
      expect(
        contrast(palette[background]!, palette[foreground]!),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(DISTINCT_PAIRS)("keeps %s and %s distinguishable", (one, other) => {
    expect(palette[one]).not.toBe(palette[other]);
    expect(contrast(palette[one]!, palette[other]!)).toBeGreaterThan(1.02);
  });
});

describe("the two schemes", () => {
  it("names the same tokens, so no component knows which one it is in", () => {
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
  });

  it("puts the paper on the dark side of the ink, and the other way round", () => {
    expect(luminance(light.surface!)).toBeGreaterThan(luminance(light.ink!));
    expect(luminance(dark.surface!)).toBeLessThan(luminance(dark.ink!));
  });
});
