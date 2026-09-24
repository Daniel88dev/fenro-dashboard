import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AccessTokenSummary } from "@/modules/identity/application/queries/access-tokens";

import { AgentAccess, type IssueTokenState } from "./agent-access";

const SERVER = "https://fenro.example/api/mcp";
const SECRET = "fenro_pat_0123456789abcdefghijklmnopqrstuvwxyzABCDEFG";

const token: AccessTokenSummary = {
  id: "token-1",
  name: "Claude Code on my laptop",
  scopes: ["tasks:read", "tasks:write"],
  hint: "WXYZ",
  state: "active",
  createdAt: "2026-09-01T10:00:00.000Z",
  expiresAt: "2026-11-30T10:00:00.000Z",
  lastUsedAt: null,
};

describe("AgentAccess", () => {
  it("shows a new token's secret and the command to connect with it", async () => {
    const issueAction = vi.fn(async (): Promise<IssueTokenState> => ({
      error: null,
      issued: { name: "Review bot", secret: SECRET },
    }));
    render(
      <AgentAccess
        serverUrl={SERVER}
        tokens={[]}
        issueAction={issueAction}
        revokeAction={vi.fn()}
      />,
    );
    expect(screen.queryByText(SECRET)).toBeNull();

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Review bot" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Create token" }));
    });

    const sent = issueAction.mock.calls[0] as unknown as [unknown, FormData];
    expect(sent[1].get("name")).toBe("Review bot");
    expect(sent[1].get("write")).toBe("on");
    expect(screen.getByText(SECRET)).toBeTruthy();
    expect(
      screen.getByText(
        `claude mcp add --transport http fenro ${SERVER} --header "Authorization: Bearer ${SECRET}"`,
      ),
    ).toBeTruthy();
  });

  it("lists tokens by name and hint, never by secret, with a way to revoke", () => {
    render(
      <AgentAccess
        serverUrl={SERVER}
        tokens={[
          token,
          { ...token, id: "token-2", name: "Old", state: "revoked" },
        ]}
        issueAction={vi.fn()}
        revokeAction={vi.fn()}
      />,
    );

    const list = screen.getByRole("list", { name: "Agent tokens" });
    expect(within(list).getAllByText(/…WXYZ/)).toHaveLength(2);
    expect(within(list).queryByText(new RegExp(SECRET))).toBeNull();
    expect(
      within(list).getByRole("button", {
        name: "Revoke Claude Code on my laptop",
      }),
    ).toBeTruthy();
    expect(
      within(list).queryByRole("button", { name: "Revoke Old" }),
    ).toBeNull();
  });

  it("keeps password managers off the name field", () => {
    render(
      <AgentAccess
        serverUrl={SERVER}
        tokens={[]}
        issueAction={vi.fn()}
        revokeAction={vi.fn()}
      />,
    );
    const name = screen.getByLabelText("Name");
    expect(name.getAttribute("data-1p-ignore")).not.toBeNull();
    expect(name.getAttribute("autocomplete")).toBe("off");
  });
});
