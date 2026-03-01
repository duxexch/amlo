import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n";

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(<App />);
} else {
  console.error("Root element not found");
}
