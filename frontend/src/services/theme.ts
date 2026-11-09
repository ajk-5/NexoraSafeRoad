import { useSyncExternalStore } from "react";

/** The operator's colour scheme. "system" follows the operating system setting. */
export type ThemeChoice = "system" | "light" | "dark";
export type Theme = "light" | "dark";

const KEY = "saferoad.theme";
const listeners = new Set<() => void>();
const darkQuery = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

let choice: ThemeChoice = readChoice();

function readChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(KEY);
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "light";
  } catch {
    return "light"; // light is the default look
  }
}

function resolve(value: ThemeChoice): Theme {
  if (value === "system") return darkQuery?.matches ? "dark" : "light";
  return value;
}

/** Puts the theme on <html data-theme>, where styles/tokens.css picks it up. */
export function applyTheme(): void {
  document.documentElement.dataset.theme = resolve(choice);
}

export function setThemeChoice(next: ThemeChoice): void {
  choice = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // Storage unavailable: the choice lasts until the page is reloaded.
  }
  applyTheme();
  listeners.forEach((listener) => listener());
}

darkQuery?.addEventListener("change", () => {
  if (choice !== "system") return;
  applyTheme();
  listeners.forEach((listener) => listener());
});

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(subscribe, () => choice);
}

/** The theme actually shown, for code that cannot use CSS variables (chart colours). */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, () => resolve(choice));
}
