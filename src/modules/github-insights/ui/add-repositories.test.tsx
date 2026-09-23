import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AddRepositories,
  type AddRepositoriesState,
  type PickerListing,
} from "./add-repositories";

const listing: PickerListing = {
  repositories: [
    {
      owner: "Daniel88dev",
      name: "fenro-dashboard",
      isPrivate: false,
      description: "The dashboard",
      watched: true,
    },
    {
      owner: "nordwind",
      name: "billing-core",
      isPrivate: true,
      description: null,
      watched: false,
    },
    {
      owner: "nordwind",
      name: "docs-site",
      isPrivate: false,
      description: null,
      watched: false,
    },
  ],
};

function answering(body: PickerListing) {
  const fetchMock = vi.fn(async () => Response.json(body));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

type AddAction = (
  state: AddRepositoriesState,
  formData: FormData,
) => Promise<AddRepositoriesState>;

function renderPicker(
  action = vi.fn<AddAction>(async () => ({ error: null, added: 1 })),
) {
  render(
    <AddRepositories
      source="/api/github/repositories"
      action={action}
      accessSettingsUrl="https://github.com/settings/connections/applications/abc"
    />,
  );
  return action;
}

async function open() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Add repositories" }));
  });
}

describe("AddRepositories", () => {
  it("reads the list from GitHub only when opened", async () => {
    const fetchMock = answering(listing);
    renderPicker();

    expect(fetchMock).not.toHaveBeenCalled();
    await open();

    expect(fetchMock).toHaveBeenCalledWith("/api/github/repositories", {
      cache: "no-store",
    });
    expect(
      screen.getByRole("checkbox", { name: /nordwind\/billing-core/ }),
    ).not.toBeChecked();
  });

  it("shows what is watched already, ticked and locked", async () => {
    answering(listing);
    renderPicker();
    await open();

    const watched = screen.getByRole("checkbox", {
      name: /Daniel88dev\/fenro-dashboard/,
    });
    expect(watched).toBeChecked();
    expect(watched).toBeDisabled();
  });

  it("keeps the search box away from password managers", async () => {
    answering(listing);
    renderPicker();
    await open();

    const search = screen.getByRole("searchbox", {
      name: "Search your repositories",
    });
    expect(search).toHaveAttribute("autocomplete", "off");
    expect(search).toHaveAttribute("data-1p-ignore");
  });

  it("narrows the list by search but still sends what was ticked", async () => {
    answering(listing);
    const action = renderPicker();
    await open();

    fireEvent.click(
      screen.getByRole("checkbox", { name: /nordwind\/billing-core/ }),
    );
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "docs" },
    });
    expect(
      screen.queryByRole("checkbox", { name: /billing-core/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /docs-site/ }));

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Add 2 repositories" }),
      );
    });

    const formData = action.mock.calls[0]?.[1];
    expect(formData?.getAll("repository")).toEqual([
      "nordwind/billing-core",
      "nordwind/docs-site",
    ]);
    expect(
      screen.queryByRole("form", { name: "Add repositories" }),
    ).not.toBeInTheDocument();
  });

  it("says why the list is missing, and offers to try again", async () => {
    const fetchMock = answering({ error: "GitHub refused access." });
    renderPicker();
    await open();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "GitHub refused access.",
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      screen.getByRole("link", { name: /Grant access on GitHub/ }),
    ).toHaveAttribute(
      "href",
      "https://github.com/settings/connections/applications/abc",
    );
  });
});
