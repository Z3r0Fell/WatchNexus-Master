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
// CSRF double-submit: axios mirrors the XSRF-TOKEN cookie into this header.
axios.defaults.xsrfCookieName = "XSRF-TOKEN";
axios.defaults.xsrfHeaderName = "X-XSRF-TOKEN";
try {
  localStorage.removeItem("token");
  localStorage.removeItem("access_token");
} catch { /* private mode */ }

// Mirror the CSRF token onto mutating fetch() calls too (axios does this
// automatically; raw fetch does not). Keeps cookie-auth CSRF working app-wide.
const _origFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
  const method = (init.method || (input && input.method) || "GET").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const m = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
    if (m) {
      const headers = new Headers(init.headers || (input && input.headers) || {});
      if (!headers.has("X-XSRF-TOKEN")) headers.set("X-XSRF-TOKEN", decodeURIComponent(m[1]));
      init = { ...init, headers, credentials: init.credentials || "same-origin" };
    }
  }
  return _origFetch(input, init);
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
