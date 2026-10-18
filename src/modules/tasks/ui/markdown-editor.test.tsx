import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarkdownEditor } from "./markdown-editor";

function setup(defaultValue = "") {
  render(
    <form aria-label="Task">
      <label htmlFor="description">Description</label>
      <MarkdownEditor
        id="description"
        name="description"
        label="Description"
        rows={4}
        defaultValue={defaultValue}
      />
    </form>,
  );
  return screen.getByLabelText<HTMLTextAreaElement>("Description");
}

describe("MarkdownEditor", () => {
  it("formats the selected text from the toolbar", () => {
    const field = setup("ship it");
    field.setSelectionRange(0, 4);

    fireEvent.click(screen.getByRole("button", { name: "Bold" }));

    expect(field.value).toBe("**ship** it");
    expect(field.value.slice(field.selectionStart, field.selectionEnd)).toBe(
      "ship",
    );
  });

  it("formats with the keyboard shortcut", () => {
    const field = setup("see docs");
    field.setSelectionRange(4, 8);

    fireEvent.keyDown(field, { key: "k", metaKey: true });

    expect(field.value).toBe("see [docs](url)");
  });

  it("continues a list on Enter", () => {
    const field = setup("- one");
    field.setSelectionRange(5, 5);

    fireEvent.keyDown(field, { key: "Enter" });

    expect(field.value).toBe("- one\n- ");
  });

  it("previews with the task page's renderer and still submits the text", () => {
    const field = setup("# Plan\n- [ ] Ship");

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    expect(field).not.toBeVisible();
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("Plan");
    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Bold" })).toBeDisabled();
    const form = screen.getByRole("form", { name: "Task" }) as HTMLFormElement;
    expect(new FormData(form).get("description")).toBe("# Plan\n- [ ] Ship");

    fireEvent.click(screen.getByRole("button", { name: "Write" }));
    expect(field).toBeVisible();
  });

  it("says so when there is nothing to preview", () => {
    setup("  ");
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    expect(screen.getByText("Nothing to preview yet.")).toBeInTheDocument();
  });
});
