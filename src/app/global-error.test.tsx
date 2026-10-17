import { render } from "@testing-library/react";
import { UnrecognizedActionError } from "next/dist/client/components/unrecognized-action-error";
import { afterEach, describe, expect, it, vi } from "vitest";

import GlobalError from "@/app/global-error";

const captureException = vi.hoisted(() => vi.fn());
vi.mock("@sentry/nextjs", () => ({ captureException }));

const reload = vi.fn();
vi.stubGlobal("location", { ...window.location, reload });

afterEach(() => vi.clearAllMocks());

describe("GlobalError", () => {
  it("reloads a page whose server actions the latest release no longer has", () => {
    render(<GlobalError error={new UnrecognizedActionError("not found")} />, {
      container: document,
    });

    expect(reload).toHaveBeenCalledOnce();
    expect(captureException).not.toHaveBeenCalled();
  });

  it("reports any other error and keeps the page", () => {
    const error = new Error("boom");
    render(<GlobalError error={error} />, { container: document });

    expect(captureException).toHaveBeenCalledWith(error);
    expect(reload).not.toHaveBeenCalled();
  });
});
