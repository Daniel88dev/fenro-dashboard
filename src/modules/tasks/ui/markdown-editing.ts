export type TextSelection = {
  readonly value: string;
  readonly start: number;
  readonly end: number;
};

export type TextEdit = {
  readonly start: number;
  readonly end: number;
  readonly text: string;
  readonly selectionStart: number;
  readonly selectionEnd: number;
};

export type FormatAction =
  | "heading"
  | "bold"
  | "italic"
  | "strikethrough"
  | "quote"
  | "code"
  | "link"
  | "bulletList"
  | "numberedList"
  | "taskList";

export const SHORTCUTS: Readonly<Record<string, FormatAction>> = {
  b: "bold",
  i: "italic",
  k: "link",
  e: "code",
};

const TASK = /^(\s*)[-*+] \[[ xX]\] /;
const BULLET = /^(\s*)[-*+] (?!\[[ xX]\] )/;
const NUMBERED = /^(\s*)\d+[.)] /;
const ANY_LIST = /^(\s*)(?:[-*+] \[[ xX]\] |[-*+] |\d+[.)] )/;
const HEADING = /^#{1,6} /;
const QUOTE = /^> ?/;

export function format(
  action: FormatAction,
  selection: TextSelection,
): TextEdit {
  switch (action) {
    case "bold":
      return wrap(selection, "**", "**", "bold text");
    case "italic":
      return wrap(selection, "_", "_", "italic text");
    case "strikethrough":
      return wrap(selection, "~~", "~~", "struck text");
    case "code":
      return code(selection);
    case "link":
      return link(selection);
    case "heading":
      return prefixLines(selection, HEADING, () => "### ", HEADING);
    case "quote":
      return prefixLines(selection, QUOTE, () => "> ", QUOTE);
    case "bulletList":
      return prefixLines(selection, BULLET, () => "- ", ANY_LIST);
    case "numberedList":
      return prefixLines(selection, NUMBERED, (n) => `${n}. `, ANY_LIST);
    case "taskList":
      return prefixLines(selection, TASK, () => "- [ ] ", ANY_LIST);
  }
}

function wrap(
  { value, start, end }: TextSelection,
  before: string,
  after: string,
  placeholder: string,
): TextEdit {
  const selected = value.slice(start, end);
  const marked = before.length + after.length;

  if (
    selected.length >= marked &&
    selected.startsWith(before) &&
    selected.endsWith(after)
  ) {
    const inner = selected.slice(before.length, selected.length - after.length);
    return replace(start, end, inner, 0, inner.length);
  }
  if (
    value.slice(start - before.length, start) === before &&
    value.slice(end, end + after.length) === after
  ) {
    return replace(
      start - before.length,
      end + after.length,
      selected,
      0,
      selected.length,
    );
  }

  const inner = selected || placeholder;
  return replace(
    start,
    end,
    before + inner + after,
    before.length,
    before.length + inner.length,
  );
}

function code(selection: TextSelection): TextEdit {
  const selected = selection.value.slice(selection.start, selection.end);
  if (!selected.includes("\n")) return wrap(selection, "`", "`", "code");
  const fenced = "```\n" + selected + "\n```";
  return replace(
    selection.start,
    selection.end,
    fenced,
    4,
    4 + selected.length,
  );
}

function link({ value, start, end }: TextSelection): TextEdit {
  const selected = value.slice(start, end);
  if (/^https?:\/\/\S+$/.test(selected)) {
    return replace(start, end, `[text](${selected})`, 1, 5);
  }
  const text = selected || "text";
  return replace(
    start,
    end,
    `[${text}](url)`,
    text.length + 3,
    text.length + 6,
  );
}

function prefixLines(
  { value, start, end }: TextSelection,
  has: RegExp,
  marker: (n: number) => string,
  strip: RegExp,
): TextEdit {
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const searchFrom = end > start && value[end - 1] === "\n" ? end - 1 : end;
  const found = value.indexOf("\n", searchFrom);
  const lineEnd = found < 0 ? value.length : found;
  const lines = value.slice(lineStart, lineEnd).split("\n");
  const filled = lines.filter((line) => line.trim());
  const removing = filled.length > 0 && filled.every((line) => has.test(line));

  let n = 0;
  const text = lines
    .map((line) => {
      const marked = line.match(has);
      if (removing) {
        return marked ? (marked[1] ?? "") + line.slice(marked[0].length) : line;
      }
      if (!line.trim() && lines.length > 1) return line;
      const indent = line.match(/^\s*/)?.[0] ?? "";
      const bare = line.replace(strip, "").trimStart();
      n += 1;
      return indent + marker(n) + bare;
    })
    .join("\n");

  if (start === end && lines.length === 1) {
    const cursor = Math.max(
      0,
      Math.min(text.length, start - lineStart + text.length - lines[0].length),
    );
    return replace(lineStart, lineEnd, text, cursor, cursor);
  }
  return replace(lineStart, lineEnd, text, 0, text.length);
}

const CONTINUED = /^(\s*)([-*+] \[[ xX]\] |[-*+] |(\d+)([.)]) )/;

export function continueList({
  value,
  start,
  end,
}: TextSelection): TextEdit | null {
  if (start !== end) return null;
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const found = value.indexOf("\n", start);
  const lineEnd = found < 0 ? value.length : found;
  const line = value.slice(lineStart, lineEnd);
  const match = line.match(CONTINUED);
  if (!match || start - lineStart < match[0].length) return null;

  if (!line.slice(match[0].length).trim()) {
    return replace(lineStart, lineEnd, "", 0, 0);
  }

  const [, indent, marker, number, delimiter] = match;
  const next = number
    ? `${Number(number) + 1}${delimiter} `
    : TASK.test(match[0])
      ? `${marker[0]} [ ] `
      : marker;
  const text = "\n" + indent + next;
  return replace(start, start, text, text.length, text.length);
}

function replace(
  start: number,
  end: number,
  text: string,
  from: number,
  to: number,
): TextEdit {
  return {
    start,
    end,
    text,
    selectionStart: start + from,
    selectionEnd: start + to,
  };
}
