import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializeDataStore } from "./lib/dataStore";

async function bootstrap() {
  await initializeDataStore();
  createRoot(document.getElementById("root")!).render(<App />);
}

void bootstrap();
