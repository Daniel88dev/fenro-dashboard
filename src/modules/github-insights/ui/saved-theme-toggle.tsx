import { cookies } from "next/headers";

import { parseTheme, THEME_COOKIE } from "./theme";
import { ThemeToggle } from "./theme-toggle";

/** The toggle, starting on the choice the reader saved in this browser. */
export async function SavedThemeToggle() {
  const saved = (await cookies()).get(THEME_COOKIE)?.value;
  return <ThemeToggle initial={parseTheme(saved)} />;
}
