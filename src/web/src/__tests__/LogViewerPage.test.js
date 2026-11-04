import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LogViewerPage from '../pages/LogViewerPage';
import { logsApi } from '../services/nexusApi';

jest.mock('../components/layout/Layout', () => ({
  Layout: ({ children }) => <div>{children}</div>,
}));
jest.mock('../services/nexusApi', () => ({
  logsApi: {
    getLatest: jest.fn(),
    getFiles: jest.fn(),
    getSystem: jest.fn(),
    deleteFile: jest.fn(),
  },
}));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const KEY = 'watchnexus.logViewer.autoRefresh';

describe('LogViewerPage', () => {
  beforeEach(() => {
    window.localStorage.getItem.mockReset();
    window.localStorage.setItem.mockReset();
    logsApi.getLatest.mockReset().mockResolvedValue({
      data: { lines: [{ line_number: 1, level: 'INFO', text: 'hello log' }], total: 1, file: 'zest.log' },
    });
    logsApi.getFiles.mockReset().mockResolvedValue({ data: [] });
    logsApi.getSystem.mockReset().mockResolvedValue({ data: null });
  });

  test('restores Live from localStorage', async () => {
    window.localStorage.getItem.mockImplementation((k) => (k === KEY ? 'true' : null));
    render(<LogViewerPage />);
    const toggle = screen.getByTestId('auto-refresh-toggle');
    expect(toggle).toHaveTextContent('Live');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await screen.findByText('hello log');
  });

  test('toggling Live persists it and refreshes immediately', async () => {
    window.localStorage.getItem.mockReturnValue(null);
    render(<LogViewerPage />);
    await screen.findByText('hello log');
    const toggle = screen.getByTestId('auto-refresh-toggle');
    expect(toggle).toHaveTextContent('Paused');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    const callsBefore = logsApi.getLatest.mock.calls.length;

    fireEvent.click(toggle);
    expect(toggle).toHaveTextContent('Live');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(window.localStorage.setItem).toHaveBeenCalledWith(KEY, 'true');
    expect(logsApi.getLatest.mock.calls.length).toBeGreaterThan(callsBefore);

    fireEvent.click(toggle);
    expect(window.localStorage.setItem).toHaveBeenLastCalledWith(KEY, 'false');
    await waitFor(() => expect(screen.getByTestId('log-refresh')).toBeInTheDocument());
  });

  test('survives localStorage throwing', async () => {
    window.localStorage.getItem.mockImplementation(() => { throw new Error('denied'); });
    window.localStorage.setItem.mockImplementation(() => { throw new Error('denied'); });
    render(<LogViewerPage />);
    fireEvent.click(screen.getByTestId('auto-refresh-toggle'));
    expect(screen.getByTestId('auto-refresh-toggle')).toHaveTextContent('Live');
    await screen.findByText('hello log');
  });

  test('shows an error banner with the status code when the endpoint is missing', async () => {
    logsApi.getLatest.mockRejectedValue({ response: { status: 404 } });
    render(<LogViewerPage />);
    const banner = await screen.findByTestId('log-error');
    expect(banner).toHaveTextContent(/log endpoint unavailable/i);
    expect(banner).toHaveTextContent('404');
    expect(screen.queryByText('No log files yet')).not.toBeInTheDocument();
  });

  test('refresh button re-fetches and clears the error once it succeeds', async () => {
    logsApi.getLatest.mockRejectedValueOnce({ response: { status: 500 } });
    render(<LogViewerPage />);
    expect(await screen.findByTestId('log-error')).toHaveTextContent('500');
    fireEvent.click(screen.getByTestId('log-refresh'));
    await screen.findByText('hello log');
    await waitFor(() => expect(screen.queryByTestId('log-error')).not.toBeInTheDocument());
  });
});
