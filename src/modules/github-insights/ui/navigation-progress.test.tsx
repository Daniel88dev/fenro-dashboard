import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/tasks";
let search = "";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(search),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import {
  NavigationProgressBar,
  NavigationProgressProvider,
  usePickPending,
  useReportPending,
} from "./navigation-progress";

const THIS_PAGE = "/tasks";
const FILTERED = "/tasks?label=agent";
const ELSEWHERE = "/repositories";

function Saving() {
  const [pending, setPending] = useState(false);
  useReportPending(pending);
  return (
    <button type="button" onClick={() => setPending((on) => !on)}>
      Toggle save
    </button>
  );
}

function Filter() {
  const [pending, pick] = usePickPending();
  return (
    <a
      href={FILTERED}
      onClick={(event) => {
        event.preventDefault();
        pick();
      }}
    >
      {pending ? "Filtering" : "Filter by agent"}
    </a>
  );
}

function App() {
  return (
    <NavigationProgressProvider>
      <NavigationProgressBar />
      <a href={ELSEWHERE} onClick={(event) => event.preventDefault()}>
        Repositories
      </a>
      <a href={THIS_PAGE} onClick={(event) => event.preventDefault()}>
        This page
      </a>
      <a
        href="https://github.com/Daniel88dev"
        onClick={(event) => event.preventDefault()}
      >
        GitHub
      </a>
      <a
        href={ELSEWHERE}
        data-progress="off"
        onClick={(event) => event.preventDefault()}
      >
        Opens a dialog
      </a>
      <Saving />
      <Filter />
    </NavigationProgressProvider>
  );
}

const line = () => screen.queryByRole("progressbar", { name: "Loading" });

describe("NavigationProgress", () => {
  beforeEach(() => {
    pathname = "/tasks";
    search = "";
    window.history.replaceState(null, "", "/tasks");
  });

  it("runs the line from a link click until the new page arrives", () => {
    const { rerender } = render(<App />);
    expect(line()).toBeNull();

    fireEvent.click(screen.getByText("Repositories"));
    expect(line()).not.toBeNull();

    pathname = "/repositories";
    rerender(<App />);
    expect(line()).toBeNull();
  });

  it("stays off for the current page, other sites, new tabs and opted-out links", () => {
    render(<App />);
    fireEvent.click(screen.getByText("This page"));
    fireEvent.click(screen.getByText("GitHub"));
    fireEvent.click(screen.getByText("Opens a dialog"));
    fireEvent.click(screen.getByText("Repositories"), { metaKey: true });
    expect(line()).toBeNull();
  });

  it("gives up on a navigation that never arrives", () => {
    vi.useFakeTimers();
    try {
      render(<App />);
      fireEvent.click(screen.getByText("Repositories"));
      expect(line()).not.toBeNull();
      act(() => vi.advanceTimersByTime(10_000));
      expect(line()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("runs the line while a reported wait is pending", () => {
    render(<App />);
    fireEvent.click(screen.getByText("Toggle save"));
    expect(line()).not.toBeNull();
    fireEvent.click(screen.getByText("Toggle save"));
    expect(line()).toBeNull();
  });

  it("marks the picking control until its new URL arrives", () => {
    const { rerender } = render(<App />);
    fireEvent.click(screen.getByText("Filter by agent"));
    expect(screen.getByText("Filtering")).toBeInTheDocument();

    search = "label=agent";
    rerender(<App />);
    expect(screen.getByText("Filter by agent")).toBeInTheDocument();
    expect(line()).toBeNull();
  });
});
