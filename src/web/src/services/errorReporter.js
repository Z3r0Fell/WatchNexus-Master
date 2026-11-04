import { apiClient } from './api';

/**
 * Client-side error reporter.
 *
 * Ships frontend crashes (error boundaries, window 'error', unhandled promise
 * rejections) to the backend log via POST /api/logs/client so they show up in
 * the Log Viewer. Fire-and-forget: never throws, never awaits in callers.
 *
 * Throttled to MAX_PER_WINDOW reports per WINDOW_MS, and identical reports
 * (same level + message + first stack line) are de-duplicated inside
 * DEDUPE_MS so a render loop cannot flood the backend.
 */

const ENDPOINT = '/logs/client';
const MAX_PER_WINDOW = 10;
const WINDOW_MS = 60_000;
const DEDUPE_MS = 60_000;
const MAX_FIELD = 8000;

let sentTimestamps = [];
const recentKeys = new Map();
let handlersInstalled = false;

function truncate(value) {
  if (value == null) return undefined;
  const s = String(value);
  return s.length > MAX_FIELD ? `${s.slice(0, MAX_FIELD)}…[truncated]` : s;
}

export function makeCorrelationId() {
  return `FE-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function shouldSend(key, now) {
  sentTimestamps = sentTimestamps.filter((t) => now - t < WINDOW_MS);
  if (sentTimestamps.length >= MAX_PER_WINDOW) return false;

  for (const [k, t] of recentKeys) {
    if (now - t >= DEDUPE_MS) recentKeys.delete(k);
  }
  if (recentKeys.has(key)) return false;

  recentKeys.set(key, now);
  sentTimestamps.push(now);
  return true;
}

/**
 * Report a client error to the backend log. Never throws.
 * @returns {boolean} true if a request was dispatched, false if dropped.
 */
export function reportClientError({
  level = 'error',
  message,
  stack,
  componentStack,
  correlationId,
  url,
  userAgent,
} = {}) {
  try {
    const msg = truncate(message) || 'Unknown client error';
    const firstStackLine = typeof stack === 'string' ? stack.split('\n')[1] || '' : '';
    const key = `${level}|${msg}|${firstStackLine.trim()}`;
    if (!shouldSend(key, Date.now())) return false;

    const body = {
      level,
      message: msg,
      stack: truncate(stack),
      componentStack: truncate(componentStack),
      correlationId: correlationId || makeCorrelationId(),
      url: url || (typeof window !== 'undefined' ? window.location?.href : undefined),
      userAgent: userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : undefined),
    };

    const p = apiClient.post(ENDPOINT, body);
    if (p && typeof p.catch === 'function') p.catch(() => { /* fire-and-forget */ });
    return true;
  } catch {
    return false;
  }
}

/**
 * Install window 'error' and 'unhandledrejection' listeners once.
 */
export function installGlobalErrorHandlers(target = typeof window !== 'undefined' ? window : null) {
  if (handlersInstalled || !target || typeof target.addEventListener !== 'function') return;
  handlersInstalled = true;

  target.addEventListener('error', (event) => {
    try {
      const err = event?.error;
      reportClientError({
        level: 'error',
        message: err?.message || event?.message || 'Uncaught error',
        stack: err?.stack || (event?.filename ? `at ${event.filename}:${event.lineno}:${event.colno}` : undefined),
      });
    } catch { /* never throw from a global handler */ }
  });

  target.addEventListener('unhandledrejection', (event) => {
    try {
      const reason = event?.reason;
      const message = reason instanceof Error
        ? reason.message
        : typeof reason === 'string' ? reason : (() => { try { return JSON.stringify(reason); } catch { return String(reason); } })();
      reportClientError({
        level: 'error',
        message: `Unhandled promise rejection: ${message}`,
        stack: reason?.stack,
      });
    } catch { /* never throw from a global handler */ }
  });
}

/** Test helper: reset throttle/dedupe state. */
export function __resetErrorReporterForTests() {
  sentTimestamps = [];
  recentKeys.clear();
  handlersInstalled = false;
}
