import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CriterionForm, type TaskAction } from "./task-forms";
import { EMPTY_FORM_STATE } from "./task-form-state";

describe("CriterionForm", () => {
  it("shows the tick before the save finishes, and keeps it once saved", async () => {
    let finish: () => void = () => {};
    const action: TaskAction = () =>
      new Promise((resolve) => {
        finish = () => resolve({ ...EMPTY_FORM_STATE, saved: 1 });
      });
    render(
      <CriterionForm
        action={action}
        task="HAL-12"
        number={1}
        text="Retries back off"
        met={false}
        evidence={null}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Tick criterion 1" }));

    expect(
      await screen.findByRole("checkbox", { name: "Untick criterion 1" }),
    ).toHaveAttribute("aria-checked", "true");
    await act(async () => finish());
  });

  it("puts the tick back when the save is refused", async () => {
    const action: TaskAction = async () => ({
      ...EMPTY_FORM_STATE,
      error: "This task is locked.",
    });
    render(
      <CriterionForm
        action={action}
        task="HAL-12"
        number={1}
        text="Retries back off"
        met={false}
        evidence={null}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Tick criterion 1" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("locked");
    expect(
      screen.getByRole("checkbox", { name: "Tick criterion 1" }),
    ).toHaveAttribute("aria-checked", "false");
  });
});
