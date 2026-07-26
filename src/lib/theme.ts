import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Theme } from "./types";

export function applyTheme(theme: Theme) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const dark = theme === "dark" || (theme === "system" && media.matches);
  document.documentElement.classList.toggle("dark", dark);

  // Synchronize Windows native DWM titlebar buttons (minimize/maximize/close) and titlebar theme
  try {
    const appWindow = getCurrentWindow();
    void appWindow.setTheme(dark ? "dark" : "light");
  } catch {
    // Ignore in non-Tauri browser environments
  }
}
