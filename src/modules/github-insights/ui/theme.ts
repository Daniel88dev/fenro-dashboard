/**
 * The reader's colour scheme choice. "system" follows the operating system,
 * which is what everyone gets until they pick otherwise.
 *
 * It is a per-browser preference kept in a cookie, not something the app
 * stores: the server reads it to render the right scheme on the first paint,
 * so there is no flash of the other one on load.
 */
export const THEMES = ["system", "light", "dark"] as const;

export type Theme = (typeof THEMES)[number];

export const THEME_COOKIE = "fenro-theme";

/** A year: long enough that the choice sticks, short enough to expire. */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function parseTheme(value: string | undefined): Theme {
  return THEMES.find((theme) => theme === value) ?? "system";
}

/**
 * The value for the html element's `data-theme`. "system" sets nothing, so
 * `globals.css` falls back to `prefers-color-scheme`.
 */
export function themeAttribute(theme: Theme): "light" | "dark" | undefined {
  return theme === "system" ? undefined : theme;
}
