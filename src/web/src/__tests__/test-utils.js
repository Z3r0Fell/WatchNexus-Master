import React from 'react';
import { render as rtlRender } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { LicenseProvider } from '../context/LicenseContext';
import { ThemeProvider } from '../context/ThemeContext';
import { GadgetProvider } from '../context/GadgetContext';
import { ErrorBoundary } from '../components/ErrorBoundary';

// Mock Toaster to avoid sonner matchMedia issues
const Toaster = ({ children }) => <div data-testid="toaster-mock">{children}</div>;

// Create a wrapper with all providers
const createWrapper = (overrides = {}) => {
  const {
    initialPath = '/',
  } = overrides;

  return ({ children }) => (
    <MemoryRouter initialEntries={[initialPath]}>
      <ErrorBoundary>
        <AuthProvider>
          <ThemeProvider>
            <GadgetProvider>
              <LicenseProvider>
                {children}
                <Toaster position="bottom-right" />
              </LicenseProvider>
            </GadgetProvider>
          </ThemeProvider>
        </AuthProvider>
      </ErrorBoundary>
    </MemoryRouter>
  );
};

export const render = (ui, options = {}) => {
  const Wrapper = createWrapper(options.wrapperOverrides);
  return rtlRender(ui, { wrapper: Wrapper, ...options });
};

// URL-routed axios.get for tests that mount several providers at once: their
// requests fire concurrently and re-fire on auth changes, so a single
// mockResolvedValueOnce sequence is order-fragile. Each route value is an axios
// response ({ data }) or a failure ({ response: { status } } / Error); an array
// is consumed one entry per call with the last entry sticking.
const isFailure = (v) => v instanceof Error || Boolean(v && v.response && v.response.status >= 400);
let currentRoutes = {};
export const okData = (data) => ({ data });
export const routeGet = (table) => {
  // eslint-disable-next-line global-require
  const axios = require('axios');
  const ax = axios.default || axios;
  currentRoutes = { ...table };
  ax.get.mockImplementation((url = '') => {
    const key = Object.keys(currentRoutes).find((k) => url.includes(k));
    if (!key) return Promise.reject({ response: { status: 404 } });
    let v = currentRoutes[key];
    if (Array.isArray(v)) v = v.length > 1 ? v.shift() : v[0];
    return isFailure(v) ? Promise.reject(v) : Promise.resolve(v);
  });
};
export const setRoute = (key, value) => { currentRoutes[key] = value; };

export { screen, fireEvent, waitFor, act } from '@testing-library/react';
export { userEvent } from '@testing-library/user-event';

// Re-export commonly used matchers
export * from '@testing-library/jest-dom';