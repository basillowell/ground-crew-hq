import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const CHUNK_RELOAD_KEY = "ground-crew-chunk-reload";
const CHUNK_LOAD_ERROR =
  /ChunkLoadError|Loading chunk \d+ failed|Failed to fetch dynamically imported module|Importing a module script failed/i;

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "";
}

function reloadAfterChunkError(message: string) {
  if (!CHUNK_LOAD_ERROR.test(message)) return;

  try {
    if (window.sessionStorage.getItem(CHUNK_RELOAD_KEY)) return;
    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, "true");
  } catch {
    return;
  }

  window.location.reload();
}

window.addEventListener("error", (event) => {
  reloadAfterChunkError(event.message || getErrorMessage(event.error));
});

window.addEventListener("unhandledrejection", (event) => {
  reloadAfterChunkError(getErrorMessage(event.reason));
});

window.addEventListener(
  "load",
  () => {
    window.sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  },
  { once: true },
);

if ("serviceWorker" in navigator) {
  void navigator.serviceWorker.register("/sw.js");
}

createRoot(document.getElementById("root")!).render(<App />);
