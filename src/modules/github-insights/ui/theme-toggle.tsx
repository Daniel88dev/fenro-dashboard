"use client";

import { Desktop, Moon, Sun } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { useState } from "react";

import {
  THEME_COOKIE,
  THEME_COOKIE_MAX_AGE,
  themeAttribute,
  type Theme,
} from "./theme";

const CHOICES: readonly { theme: Theme; label: string; icon: Icon }[] = [
  { theme: "system", label: "Match system", icon: Desktop },
  { theme: "light", label: "Light", icon: Sun },
  { theme: "dark", label: "Dark", icon: Moon },
];

/** Outside the component: it touches the document, not React state. */
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const attribute = themeAttribute(theme);
  if (attribute) root.setAttribute("data-theme", attribute);
  else root.removeAttribute("data-theme");
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`;
}

/**
 * Three icon buttons in the top bar. Icons only, so the bar still fits the
 * brand and the account menu at phone width; each button carries its name for
 * screen readers and as a tooltip.
 *
 * Choosing flips the html element's `data-theme` straight away and writes the
 * cookie the root layout reads, so the next page load renders the same way.
 */
export function ThemeToggle({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState(initial);

  function choose(next: Theme) {
    setTheme(next);
    applyTheme(next);
  }

  return (
    <div
      role="group"
      aria-label="Colour scheme"
      className="flex items-center gap-0.5"
    >
      {CHOICES.map(({ theme: choice, label, icon: ChoiceIcon }) => {
        const chosen = choice === theme;
        return (
          <button
            key={choice}
            type="button"
            aria-label={label}
            aria-pressed={chosen}
            title={label}
            onClick={() => choose(choice)}
            className={`focus-visible:outline-bar-ink grid size-7 cursor-pointer place-items-center rounded-lg focus-visible:outline-2 ${
              chosen
                ? "bg-bar-active text-bar-ink"
                : "text-bar-ink-muted hover:text-bar-ink"
            }`}
          >
            <ChoiceIcon aria-hidden="true" className="size-[15px]" />
          </button>
        );
      })}
    </div>
  );
}
