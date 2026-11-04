import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import {
  RouteErrorBoundary,
  withErrorBoundary,
  ErrorBoundaryWrapper,
  isChunkLoadError,
} from '../components/RouteErrorBoundary';
import { reportClientError, makeCorrelationId } from '../services/errorReporter';

jest.mock('../services/errorReporter', () => ({
  reportClientError: jest.fn(),
  makeCorrelationId: jest.fn(),
}));
jest.mock('../components/ui/sonner', () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));

let shouldThrow = true;
let mountCount = 0;
function Flaky() {
  React.useEffect(() => { mountCount += 1; }, []);
  if (shouldThrow) throw new Error('player exploded');
  return <div>Player OK</div>;
}

describe('RouteErrorBoundary', () => {
  let consoleErrorSpy;
  beforeEach(() => {
    shouldThrow = true;
    mountCount = 0;
    makeCorrelationId.mockReturnValue('FE-test-123');
    reportClientError.mockClear();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => consoleErrorSpy.mockRestore());

  test('Go to Dashboard navigates to / and clears the error', () => {
    render(
      <MemoryRouter initialEntries={['/player']}>
        <Routes>
          <Route path="/" element={<div>Dashboard Home</div>} />
          <Route path="/player" element={<RouteErrorBoundary routeName="Video Player"><Flaky /></RouteErrorBoundary>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Error in Video Player')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /go to dashboard/i }));
    expect(screen.getByText('Dashboard Home')).toBeInTheDocument();
    expect(screen.queryByText('Error in Video Player')).not.toBeInTheDocument();
  });

  test('Try Again remounts the child, which renders once it no longer throws', () => {
    render(
      <MemoryRouter>
        <RouteErrorBoundary routeName="Video Player"><Flaky /></RouteErrorBoundary>
      </MemoryRouter>
    );
    expect(screen.getByText('Error in Video Player')).toBeInTheDocument();
    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(screen.getByText('Player OK')).toBeInTheDocument();
    expect(mountCount).toBe(1);
  });

  test('after max retries offers a Reload Page fallback instead of a disabled button', () => {
    render(
      <MemoryRouter>
        <RouteErrorBoundary><Flaky /></RouteErrorBoundary>
      </MemoryRouter>
    );
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    }
    const reload = screen.getByRole('button', { name: /reload page/i });
    expect(reload).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /go to dashboard/i })).not.toBeDisabled();
  });

  test('reports the error to the backend via errorReporter', () => {
    render(
      <MemoryRouter>
        <RouteErrorBoundary routeName="Video Player"><Flaky /></RouteErrorBoundary>
      </MemoryRouter>
    );
    expect(reportClientError).toHaveBeenCalledTimes(1);
    const payload = reportClientError.mock.calls[0][0];
    expect(payload.level).toBe('error');
    expect(payload.message).toContain('player exploded');
    expect(payload.message).toContain('Video Player');
    expect(payload.correlationId).toBe('FE-test-123');
    expect(payload.stack).toEqual(expect.any(String));
    expect(payload.componentStack).toEqual(expect.any(String));
  });

  test('auto-resets when the route changes', () => {
    render(
      <MemoryRouter initialEntries={['/a']}>
        <Link to="/b">go to b</Link>
        <RouteErrorBoundary>
          <Routes>
            <Route path="/a" element={<Flaky />} />
            <Route path="/b" element={<div>Page B</div>} />
          </Routes>
        </RouteErrorBoundary>
      </MemoryRouter>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    fireEvent.click(screen.getByText('go to b'));
    expect(screen.getByText('Page B')).toBeInTheDocument();
  });

  test('withErrorBoundary and ErrorBoundaryWrapper still work', () => {
    const Wrapped = withErrorBoundary(Flaky, 'Movies');
    const { unmount } = render(<MemoryRouter><Wrapped /></MemoryRouter>);
    expect(screen.getByText('Error in Movies')).toBeInTheDocument();
    unmount();
    render(<MemoryRouter><ErrorBoundaryWrapper routeName="TV"><Flaky /></ErrorBoundaryWrapper></MemoryRouter>);
    expect(screen.getByText('Error in TV')).toBeInTheDocument();
  });

  test('renders outside a Router without crashing', () => {
    render(<RouteErrorBoundary><Flaky /></RouteErrorBoundary>);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  describe('chunk load errors', () => {
    const originalLocation = window.location;
    beforeEach(() => {
      delete window.location;
      window.location = { ...originalLocation, reload: jest.fn(), assign: jest.fn() };
    });
    afterEach(() => { window.location = originalLocation; });

    test('Retry does a full page reload for a failed lazy chunk', () => {
      function ChunkFail() {
        const e = new Error('Loading chunk 42 failed.');
        e.name = 'ChunkLoadError';
        throw e;
      }
      render(<MemoryRouter><RouteErrorBoundary><ChunkFail /></RouteErrorBoundary></MemoryRouter>);
      fireEvent.click(screen.getByRole('button', { name: /reload page/i }));
      expect(window.location.reload).toHaveBeenCalled();
    });

    test('isChunkLoadError detects common chunk failure messages', () => {
      expect(isChunkLoadError(Object.assign(new Error('x'), { name: 'ChunkLoadError' }))).toBe(true);
      expect(isChunkLoadError(new Error('Loading chunk 7 failed.'))).toBe(true);
      expect(isChunkLoadError(new Error('Failed to fetch dynamically imported module: /x.js'))).toBe(true);
      expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
      expect(isChunkLoadError(null)).toBe(false);
    });
  });
});
