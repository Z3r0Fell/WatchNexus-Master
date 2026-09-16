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

export { screen, fireEvent, waitFor, act } from '@testing-library/react';
export { userEvent } from '@testing-library/user-event';

// Re-export commonly used matchers
export * from '@testing-library/jest-dom';