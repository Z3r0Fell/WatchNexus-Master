import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { reportClientError, makeCorrelationId } from '../services/errorReporter';

jest.mock('../services/errorReporter', () => ({
  reportClientError: jest.fn(),
  makeCorrelationId: jest.fn(),
}));

function Boom() { throw new Error('top-level crash'); }

describe('ErrorBoundary (top-level)', () => {
  let spy;
  beforeEach(() => {
    reportClientError.mockClear();
    makeCorrelationId.mockReturnValue('FE-top');
    spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => spy.mockRestore());

  test('reports the crash and Go to Dashboard navigates home', () => {
    render(
      <MemoryRouter initialEntries={['/broken']}>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<div>Dashboard Home</div>} />
            <Route path="/broken" element={<Boom />} />
          </Routes>
        </ErrorBoundary>
      </MemoryRouter>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(reportClientError).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('top-level crash'),
      correlationId: 'FE-top',
    }));
    fireEvent.click(screen.getByRole('button', { name: /go to dashboard/i }));
    expect(screen.getByText('Dashboard Home')).toBeInTheDocument();
  });

  test('resets when the location changes', () => {
    render(
      <MemoryRouter initialEntries={['/broken']}>
        <ErrorBoundary fallback={<Link to="/ok">escape</Link>}>
          <Routes>
            <Route path="/ok" element={<div>Fine now</div>} />
            <Route path="/broken" element={<Boom />} />
          </Routes>
        </ErrorBoundary>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText('escape'));
    expect(screen.getByText('Fine now')).toBeInTheDocument();
  });

  test('renders children normally and works without a Router', () => {
    render(<ErrorBoundary><div>hello</div></ErrorBoundary>);
    expect(screen.getByText('hello')).toBeInTheDocument();
  });
});
