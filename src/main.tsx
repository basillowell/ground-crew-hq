import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Stale chunk recovery — catches failed dynamic imports after deploy
const RELOAD_FLAG = "gcrew-chunk-reload";

window.addEventListener("error", (event) => {
  const msg = event.message ?? "";
  if (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Importing a module script failed")
  ) {
    if (!sessionStorage.getItem(RELOAD_FLAG)) {
      sessionStorage.setItem(RELOAD_FLAG, "1");
      window.location.reload();
    }
  }
});

window.addEventListener("unhandledrejection", (event) => {
  const msg = String(event.reason?.message ?? event.reason ?? "");
  if (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Importing a module script failed") ||
    msg.includes("Unable to preload CSS")
  ) {
    event.preventDefault();
    if (!sessionStorage.getItem(RELOAD_FLAG)) {
      sessionStorage.setItem(RELOAD_FLAG, "1");
      window.location.reload();
    }
  }
});

// Clear the reload flag once the app loads successfully
window.addEventListener("load", () => {
  sessionStorage.removeItem(RELOAD_FLAG);
});

if ("serviceWorker" in navigator) {
  void navigator.serviceWorker.register("/sw.js");
}

createRoot(document.getElementById("root")!).render(<App />);
