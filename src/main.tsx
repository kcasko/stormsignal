import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/source-serif-4/opsz.css";
import "@fontsource-variable/public-sans/wght.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import { App } from "./App";
import "./style.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Offline support in production builds only (the dev server should never be cached).
if (import.meta.env.PROD && "serviceWorker" in navigator)
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => undefined));
