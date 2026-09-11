import { useEffect, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const KEY = "studycare-theme";
const listeners = new Set<() => void>();

function readStored(): Theme {
  const saved = localStorage.getItem(KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

let current: Theme = readStored();

function emit(): void {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): Theme {
  return current;
}

export function applyTheme(t: Theme): void {
  document.documentElement.setAttribute("data-theme", t);
}

export function initTheme(): void {
  current = readStored();
  applyTheme(current);
}

export function setThemeStore(t: Theme): void {
  current = t;
  applyTheme(t);
  localStorage.setItem(KEY, t);
  emit();
}

export function useTheme(): { theme: Theme; toggle: () => void; set: (t: Theme) => void } {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return {
    theme,
    toggle: () => setThemeStore(theme === "dark" ? "light" : "dark"),
    set: setThemeStore,
  };
}