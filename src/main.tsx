import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { QuickCaptureWindow } from "./components/capture/QuickCaptureWindow";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./styles.css";
import { queryClient } from "./lib/queryClient";

import { isTauri } from "./lib/utils";

// Kill macOS autocorrect/autocapitalize/spellcheck in every text field.
document.addEventListener("focusin", (event) => {
  const el = event.target;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    el.setAttribute("autocorrect", "off");
    el.setAttribute("autocomplete", "off");
    el.autocapitalize = "off";
    el.spellcheck = false;
  }
});

let windowLabel = "main";
try {
  if (isTauri()) {
    windowLabel = getCurrentWindow().label;
  }
} catch {
  // Web fallback
}

const Root = windowLabel === "quick-capture" ? QuickCaptureWindow : App;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Root />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
