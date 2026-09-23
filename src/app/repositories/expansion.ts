/**
 * Expansion state lives in the URL, as ticket 02 settled, so a row you opened
 * survives a refresh and can be pasted into a task.
 *
 * Encoding: one repeatable `open` parameter per open panel, written
 * `owner/name:column` — `?open=nordwind/billing-core:prs&open=nordwind/docs-site:issues`.
 * A pull request's checks are a separate `pr` parameter, `owner/name:number`,
 * because the checks hang off a pull request rather than off the row. An
 * issues panel's filter chips are a repeatable `issues` parameter,
 * `owner/name:chip`, one per chip pressed.
 *
 * Daniel chose inline expansion with several rows open at once (ticket 04), so
 * the parameter has to be repeatable. How it encodes is ticket 10's to confirm.
 */

export const COLUMNS = ["prs", "issues", "tasks"] as const;

export type Column = (typeof COLUMNS)[number];

export const ISSUE_CHIPS = ["assigned", "triage", "oldest"] as const;

export type IssueChip = (typeof ISSUE_CHIPS)[number];

export type PanelKey = {
  readonly owner: string;
  readonly name: string;
  readonly column: Column;
};

export type ExpansionState = {
  readonly open: readonly PanelKey[];
  /** The pull requests whose checks are showing, keyed `owner/name`. */
  readonly openPullRequests: readonly {
    readonly owner: string;
    readonly name: string;
    readonly number: number;
  }[];
  /** The filter chips pressed on each open issues panel. */
  readonly issueChips: readonly {
    readonly owner: string;
    readonly name: string;
    readonly chip: IssueChip;
  }[];
  readonly filter: string;
};

export type SearchParams = Record<string, string | string[] | undefined>;

function values(params: SearchParams, key: string): string[] {
  const value = params[key];
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function isColumn(value: string): value is Column {
  return (COLUMNS as readonly string[]).includes(value);
}

function isIssueChip(value: string): value is IssueChip {
  return (ISSUE_CHIPS as readonly string[]).includes(value);
}

export function panelId({ owner, name, column }: PanelKey): string {
  return `panel-${owner}-${name}-${column}`.replace(/[^A-Za-z0-9_-]/g, "-");
}

export function samePanel(one: PanelKey, other: PanelKey): boolean {
  return (
    one.owner === other.owner &&
    one.name === other.name &&
    one.column === other.column
  );
}

export function parseExpansion(params: SearchParams): ExpansionState {
  const open = values(params, "open").flatMap((value) => {
    const [fullName, column] = value.split(":");
    if (!fullName || !column || !isColumn(column)) return [];
    const [owner, name] = fullName.split("/");
    if (!owner || !name) return [];
    return [{ owner, name, column }];
  });

  const openPullRequests = values(params, "pr").flatMap((value) => {
    const [fullName, rawNumber] = value.split(":");
    if (!fullName || !rawNumber) return [];
    const [owner, name] = fullName.split("/");
    const number = Number(rawNumber);
    if (!owner || !name || !Number.isInteger(number) || number <= 0) return [];
    return [{ owner, name, number }];
  });

  const issueChips = values(params, "issues").flatMap((value) => {
    const [fullName, chip] = value.split(":");
    if (!fullName || !chip || !isIssueChip(chip)) return [];
    const [owner, name] = fullName.split("/");
    if (!owner || !name) return [];
    return [{ owner, name, chip }];
  });

  const filter = values(params, "q")[0]?.trim() ?? "";

  return { open, openPullRequests, issueChips, filter };
}

export function isOpen(state: ExpansionState, key: PanelKey): boolean {
  return state.open.some((one) => samePanel(one, key));
}

export function isPullRequestOpen(
  state: ExpansionState,
  owner: string,
  name: string,
  number: number,
): boolean {
  return state.openPullRequests.some(
    (one) => one.owner === owner && one.name === name && one.number === number,
  );
}

function toSearch(state: ExpansionState): URLSearchParams {
  const search = new URLSearchParams();
  for (const key of state.open) {
    search.append("open", `${key.owner}/${key.name}:${key.column}`);
  }
  for (const one of state.openPullRequests) {
    search.append("pr", `${one.owner}/${one.name}:${one.number}`);
  }
  for (const one of state.issueChips) {
    search.append("issues", `${one.owner}/${one.name}:${one.chip}`);
  }
  if (state.filter) search.set("q", state.filter);
  return search;
}

function href(pathname: string, state: ExpansionState): string {
  const search = toSearch(state).toString();
  return search ? `${pathname}?${search}` : pathname;
}

/**
 * The URL that opens this panel if it is closed, and closes it if it is open.
 * Closing a row's panel also closes any pull request opened inside it and
 * releases any chip pressed on it, so the URL never keeps state the reader
 * cannot see.
 */
export function togglePanelHref(
  pathname: string,
  state: ExpansionState,
  key: PanelKey,
): string {
  if (!isOpen(state, key)) {
    return href(pathname, { ...state, open: [...state.open, key] });
  }

  const open = state.open.filter((one) => !samePanel(one, key));
  const inRow = (one: { owner: string; name: string }) =>
    one.owner === key.owner && one.name === key.name;
  const openPullRequests =
    key.column === "prs"
      ? state.openPullRequests.filter((one) => !inRow(one))
      : state.openPullRequests;
  const issueChips =
    key.column === "issues"
      ? state.issueChips.filter((one) => !inRow(one))
      : state.issueChips;

  return href(pathname, { ...state, open, openPullRequests, issueChips });
}

export function isIssueChipPressed(
  state: ExpansionState,
  owner: string,
  name: string,
  chip: IssueChip,
): boolean {
  return state.issueChips.some(
    (one) => one.owner === owner && one.name === name && one.chip === chip,
  );
}

/** The URL that presses this chip on a row's issues panel, or releases it. */
export function toggleIssueChipHref(
  pathname: string,
  state: ExpansionState,
  owner: string,
  name: string,
  chip: IssueChip,
): string {
  const issueChips = isIssueChipPressed(state, owner, name, chip)
    ? state.issueChips.filter(
        (one) =>
          !(one.owner === owner && one.name === name && one.chip === chip),
      )
    : [...state.issueChips, { owner, name, chip }];

  return href(pathname, { ...state, issueChips });
}

export function togglePullRequestHref(
  pathname: string,
  state: ExpansionState,
  owner: string,
  name: string,
  number: number,
): string {
  const openPullRequests = isPullRequestOpen(state, owner, name, number)
    ? state.openPullRequests.filter(
        (one) =>
          !(one.owner === owner && one.name === name && one.number === number),
      )
    : [...state.openPullRequests, { owner, name, number }];

  return href(pathname, { ...state, openPullRequests });
}
