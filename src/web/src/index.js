import React from "react";
import ReactDOM from "react-dom/client";
import axios from "axios";
import "@/index.css";
import App from "@/App";
import "./i18n";

// S-02: JWT now lives in an httpOnly cookie (set by the backend on login).
// Send cookies on every request (covers cross-origin/Electron; same-origin
// sends them anyway) and purge any token left in localStorage by older builds
// so it can no longer be read by JavaScript / stolen via XSS.
axios.defaults.withCredentials = true;
try {
  localStorage.removeItem("token");
  localStorage.removeItem("access_token");
} catch { /* private mode */ }

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
