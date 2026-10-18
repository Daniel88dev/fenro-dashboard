import { describe, expect, it } from "vitest";

import {
  continueList,
  format,
  type FormatAction,
  type TextEdit,
  type TextSelection,
} from "./markdown-editing";

// « and » mark the selection; a lone ‸ marks the cursor.
function parse(marked: string): TextSelection {
  const cursor = marked.indexOf("‸");
  if (cursor >= 0) {
    return { value: marked.replace("‸", ""), start: cursor, end: cursor };
  }
  const start = marked.indexOf("«");
  const end = marked.indexOf("»") - 1;
  return { value: marked.replace("«", "").replace("»", ""), start, end };
}

function show(selection: TextSelection, edit: TextEdit): string {
  const value =
    selection.value.slice(0, edit.start) +
    edit.text +
    selection.value.slice(edit.end);
  if (edit.selectionStart === edit.selectionEnd) {
    return (
      value.slice(0, edit.selectionStart) +
      "‸" +
      value.slice(edit.selectionStart)
    );
  }
  return (
    value.slice(0, edit.selectionStart) +
    "«" +
    value.slice(edit.selectionStart, edit.selectionEnd) +
    "»" +
    value.slice(edit.selectionEnd)
  );
}

function apply(action: FormatAction, marked: string): string {
  const selection = parse(marked);
  return show(selection, format(action, selection));
}

function enter(marked: string): string | null {
  const selection = parse(marked);
  const edit = continueList(selection);
  return edit ? show(selection, edit) : null;
}

describe("format", () => {
  it("wraps the selection and keeps it selected", () => {
    expect(apply("bold", "a «word» here")).toBe("a **«word»** here");
    expect(apply("italic", "«word»")).toBe("_«word»_");
    expect(apply("strikethrough", "«word»")).toBe("~~«word»~~");
    expect(apply("code", "run «pnpm verify»")).toBe("run `«pnpm verify»`");
  });

  it("selects a placeholder when nothing is selected", () => {
    expect(apply("bold", "a ‸")).toBe("a **«bold text»**");
  });

  it("unwraps text that is already formatted", () => {
    expect(apply("bold", "a **«word»** here")).toBe("a «word» here");
    expect(apply("bold", "a «**word**» here")).toBe("a «word» here");
  });

  it("fences a multi-line selection as a code block", () => {
    expect(apply("code", "«a\nb»")).toBe("```\n«a\nb»\n```");
  });

  it("selects the url to type when linking text", () => {
    expect(apply("link", "see «the plan»")).toBe("see [the plan](«url»)");
  });

  it("selects the text to type when linking a url", () => {
    expect(apply("link", "«https://github.com/x»")).toBe(
      "[«text»](https://github.com/x)",
    );
  });

  it("prefixes every selected line", () => {
    expect(apply("bulletList", "«one\ntwo»")).toBe("«- one\n- two»");
    expect(apply("numberedList", "«one\n\ntwo»")).toBe("«1. one\n\n2. two»");
    expect(apply("taskList", "«one\ntwo»")).toBe("«- [ ] one\n- [ ] two»");
    expect(apply("quote", "«one\ntwo»")).toBe("«> one\n> two»");
  });

  it("works on the whole line around the cursor", () => {
    expect(apply("heading", "Intro\nPla‸n")).toBe("Intro\n### Pla‸n");
    expect(apply("bulletList", "‸")).toBe("- ‸");
  });

  it("removes the prefix when every line already has it", () => {
    expect(apply("bulletList", "«- one\n- two»")).toBe("«one\ntwo»");
    expect(apply("heading", "## Pla‸n")).toBe("Pla‸n");
    expect(apply("quote", "«> one»")).toBe("«one»");
  });

  it("switches one kind of list to another, keeping indentation", () => {
    expect(apply("numberedList", "«- one\n  - two»")).toBe(
      "«1. one\n  2. two»",
    );
    expect(apply("taskList", "«1. one»")).toBe("«- [ ] one»");
  });

  it("does not take in the next line when the selection ends at a newline", () => {
    expect(apply("quote", "«one\n»two")).toBe("«> one»\ntwo");
  });
});

describe("continueList", () => {
  it("starts the next item of the same list", () => {
    expect(enter("- one‸")).toBe("- one\n- ‸");
    expect(enter("  * one‸")).toBe("  * one\n  * ‸");
    expect(enter("9. one‸")).toBe("9. one\n10. ‸");
    expect(enter("- [x] done‸")).toBe("- [x] done\n- [ ] ‸");
  });

  it("ends the list on an empty item", () => {
    expect(enter("- one\n- ‸")).toBe("- one\n‸");
  });

  it("leaves Enter alone outside a list", () => {
    expect(enter("plain‸")).toBeNull();
    expect(enter("‸- one")).toBeNull();
    expect(enter("- «one»")).toBeNull();
  });
});
