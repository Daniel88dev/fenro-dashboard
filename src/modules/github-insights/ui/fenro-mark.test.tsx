import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FenroMark } from "./fenro-mark";

function shapes(root: ParentNode) {
  return {
    paths: [...root.querySelectorAll("path")].map((p) => p.getAttribute("d")),
    rects: [...root.querySelectorAll("rect")].map((r) =>
      ["x", "y", "width", "height", "rx", "fill-opacity"]
        .map((a) => r.getAttribute(a))
        .join(","),
    ),
  };
}

describe("FenroMark", () => {
  it("draws the same shapes as the favicon, so the two cannot drift apart", () => {
    const favicon = new DOMParser().parseFromString(
      readFileSync(join(process.cwd(), "src/app/icon.svg"), "utf8"),
      "image/svg+xml",
    );
    const { container } = render(<FenroMark />);

    expect(shapes(container)).toEqual(shapes(favicon));
  });

  it("colours itself from the pull-request tokens so it follows the scheme", () => {
    const { container } = render(<FenroMark />);

    expect(container.querySelector("rect")).toHaveClass("fill-pr");
    expect(container.querySelector("rect ~ g")).toHaveClass("fill-on-pr");
    expect(container.querySelector("path")?.parentElement).toHaveClass(
      "stroke-on-pr",
    );
  });
});
