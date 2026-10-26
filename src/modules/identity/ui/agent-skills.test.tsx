import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AgentSkills, INSTALL_SKILLS_COMMAND } from "./agent-skills";

describe("AgentSkills", () => {
  it("installs the skills from the repository's skills folder", () => {
    expect(INSTALL_SKILLS_COMMAND).toBe(
      "npx skills add https://github.com/Daniel88dev/fenro-dashboard/tree/main/skills",
    );
  });

  it("walks through install, setup and working a task with this Fenro's address", () => {
    render(<AgentSkills appUrl="https://fenro.example" />);

    const steps = screen.getByRole("list", { name: "Set up a repository" });
    expect(
      Array.from(steps.querySelectorAll("h3"), (h) => h.textContent),
    ).toEqual(["Install the skills", "Connect the repository", "Work a task"]);
    expect(screen.getByText(INSTALL_SKILLS_COMMAND)).toBeTruthy();
    expect(screen.getByText("https://fenro.example")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^Copy/ })).toHaveLength(3);
  });
});
