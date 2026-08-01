import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { applyPlatformClass } from "./utils/platform";

applyPlatformClass();

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("找不到 #root 节点");
}

try {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  );
} catch (err) {
  const msg = err instanceof Error ? `${err.message}\n${err.stack || ""}` : String(err);
  const boot = (window as unknown as { __mp3freerBootError?: (m: string) => void }).__mp3freerBootError;
  if (boot) boot(msg);
  else rootEl.textContent = msg;
}
