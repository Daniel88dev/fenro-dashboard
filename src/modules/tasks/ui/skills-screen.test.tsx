import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
}));

import type {
  LabelItem,
  SkillDetail,
  SkillItem,
  SkillRevisionItem,
} from "@/modules/tasks/application/queries/read-models";

import { revisionChange } from "./skill-history";
import { SkillsScreen } from "./skills-screen";
import type { SkillActions } from "./skill-views";
import { TaskSkills } from "./task-skills";

const idle = vi.fn(async () => ({ error: null, saved: 0 }));
const actions: SkillActions = {
  save: idle,
  restore: idle,
  remove: idle,
  link: idle,
  unlink: idle,
  createLabel: idle,
  renameLabel: idle,
  recolourLabel: idle,
};

const now = new Date("2026-10-04T12:00:00.000Z");

const frontend: SkillItem = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "frontend-conventions",
  description: "Use when building or changing UI.",
  labels: ["frontend", "ui"],
  revision: 2,
  openTasks: 4,
  updatedBy: "claude-code",
  updatedByKind: "agent",
  updatedAt: "2026-10-04T10:00:00.000Z",
};

const migrations: SkillItem = {
  id: "00000000-0000-4000-8000-000000000002",
  name: "drizzle-migrations",
  description: "Use when a task changes a table.",
  labels: [],
  revision: 1,
  openTasks: 0,
  updatedBy: "Daniel88dev",
  updatedByKind: "human",
  updatedAt: "2026-10-01T10:00:00.000Z",
};

const revision = (
  number: number,
  text: Partial<SkillRevisionItem> = {},
): SkillRevisionItem => ({
  revision: number,
  name: "frontend-conventions",
  description: "Use when building or changing UI.",
  instructions: "## Colours\n- Tokens, never a dark: class.",
  by: "Daniel88dev",
  byKind: "human",
  at: "2026-10-03T10:00:00.000Z",
  ...text,
});

const detail: SkillDetail = {
  ...frontend,
  instructions: "## Colours\n- Tokens, never a dark: class.",
  createdBy: "Daniel88dev",
  createdByKind: "human",
  createdAt: "2026-10-03T10:00:00.000Z",
  revisions: [
    revision(2, {
      instructions: "## Colours\n- Tokens, never a dark: class.",
      by: "claude-code",
      byKind: "agent",
    }),
    revision(1, { instructions: "## Colours" }),
  ],
};

const labels: LabelItem[] = [
  {
    name: "frontend",
    colour: "blue",
    openTasks: 3,
    tasks: 5,
    skills: ["frontend-conventions"],
  },
  { name: "ui", colour: "purple", openTasks: 1, tasks: 1, skills: [] },
];

describe("revisionChange", () => {
  it("names the fields a revision changed", () => {
    expect(
      revisionChange(
        revision(3, { name: "ui-rules", instructions: "New" }),
        revision(2),
      ),
    ).toBe("Changed the name and the instructions");
  });

  it("calls the first revision Created and an unchanged one Restored", () => {
    expect(revisionChange(revision(1), undefined)).toBe("Created");
    expect(revisionChange(revision(3), revision(2))).toBe("Restored");
  });
});

describe("SkillsScreen", () => {
  const skillsTab = () =>
    render(
      <SkillsScreen
        tab="skills"
        skills={[migrations, frontend]}
        labels={labels}
        skill={detail}
        label={undefined}
        actions={actions}
        now={now}
      />,
    );

  it("opens the skill beside the list, with who changed it last", () => {
    skillsTab();
    const editor = screen.getByRole("region", {
      name: "Skill frontend-conventions",
    });
    expect(within(editor).getByLabelText("Name")).toHaveValue(
      "frontend-conventions",
    );
    expect(within(editor).getByText(/^Edited/)).toHaveTextContent(
      "Edited 2 h ago by claude-code (agent)",
    );
    expect(
      within(editor).getByText("Applies to 4 open tasks through frontend, ui."),
    ).toBeVisible();
    const current = screen
      .getByRole("link", { name: /frontend-conventions/ })
      .getAttribute("aria-current");
    expect(current).toBe("true");
  });

  it("searches the list by name and description", () => {
    skillsTab();
    const list = screen.getByRole("region", { name: "Skills" });
    fireEvent.change(within(list).getByPlaceholderText("Search skills"), {
      target: { value: "table" },
    });
    expect(within(list).getByText("drizzle-migrations")).toBeVisible();
    expect(within(list).queryByText("frontend-conventions")).toBeNull();
  });

  it("offers Save only once something changed", () => {
    skillsTab();
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();
    fireEvent.input(screen.getByLabelText("When to use it"), {
      target: { value: "Use when touching any screen." },
    });
    expect(save).toBeEnabled();
    expect(screen.getByText("Unsaved changes")).toBeVisible();
  });

  it("asks before deleting a skill", () => {
    skillsTab();
    fireEvent.click(screen.getByRole("button", { name: "Delete skill" }));
    expect(
      screen.getByRole("button", { name: "Delete frontend-conventions" }),
    ).toBeVisible();
  });

  it("previews the instructions as Markdown", () => {
    skillsTab();
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.getByRole("heading", { name: "Colours" })).toBeVisible();
  });

  it("asks before restoring an older revision", () => {
    skillsTab();
    const history = screen.getByRole("complementary", { name: "History" });
    expect(within(history).getByText("Current")).toBeVisible();
    fireEvent.click(within(history).getByRole("button", { name: "Restore" }));
    expect(
      within(history).getByRole("button", { name: "Restore rev 1" }),
    ).toBeVisible();
  });

  it("links from the label side only skills not linked yet", () => {
    render(
      <SkillsScreen
        tab="labels"
        skills={[migrations, frontend]}
        labels={labels}
        skill={undefined}
        label={labels[0]}
        actions={actions}
        now={now}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Unlink frontend-conventions" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Link a skill" }));
    const picker = screen.getByRole("dialog", { name: "Link a skill" });
    expect(within(picker).getByText("drizzle-migrations")).toBeVisible();
    expect(within(picker).queryByText("frontend-conventions")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Blue", pressed: true }),
    ).toBeVisible();
  });
});

describe("TaskSkills", () => {
  it("lists each skill with the labels that brought it in", () => {
    render(
      <TaskSkills
        skills={[
          {
            name: "frontend-conventions",
            description: "Use when building or changing UI.",
            via: ["frontend", "ui"],
            revision: 2,
            instructions: null,
          },
        ]}
        labels={labels}
      />,
    );
    expect(
      screen.getByRole("link", { name: "frontend-conventions" }),
    ).toHaveAttribute("href", "/skills?skill=frontend-conventions");
    expect(screen.getByText("ui")).toBeVisible();
  });

  it("says where to add one when there are none", () => {
    render(<TaskSkills skills={[]} labels={labels} />);
    expect(screen.getByText(/No skills/)).toBeVisible();
  });
});
