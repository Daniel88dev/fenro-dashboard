import { cookies } from "next/headers";

import { parseTheme, THEME_COOKIE } from "./theme";
import { ThemeToggle, type ThemeToggleTone } from "./theme-toggle";

export async function SavedThemeToggle({ tone }: { tone?: ThemeToggleTone }) {
  const saved = (await cookies()).get(THEME_COOKIE)?.value;
  return <ThemeToggle initial={parseTheme(saved)} tone={tone} />;
}
