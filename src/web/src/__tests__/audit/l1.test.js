import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LobsterPage from '../../pages/LobsterPage';
import { lobsterApi } from '../../services/nexusApi';

jest.mock('../../components/layout/Layout', () => ({
  Layout: ({ children }) => <div>{children}</div>,
}));
jest.mock('../../services/nexusApi', () => ({
  lobsterApi: {
    getStatus: jest.fn(),
    getPeers: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    pair: jest.fn(),
  },
}));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

describe('LobsterPage (L1 sidecar contract)', () => {
  beforeEach(() => {
    Object.values(lobsterApi).forEach((fn) => fn.mockReset());
    lobsterApi.getPeers.mockResolvedValue({ data: [] });
  });

  test('not configured: shows the reason and disables Start', async () => {
    lobsterApi.getStatus.mockResolvedValue({
      data: { status: 'not_configured', configured: false, online: false, message: 'Lobster is not configured: set LOBSTER_CONTROL_URL' },
    });
    render(<LobsterPage />);
    await screen.findByText(/set LOBSTER_CONTROL_URL/);
    expect(screen.getByRole('button', { name: /Start Node/ })).toBeDisabled();
  });

  test('needs login: renders the http(s) auth URL and offers Stop', async () => {
    lobsterApi.getStatus.mockResolvedValue({
      data: { status: 'needs_login', configured: true, online: false, auth_url: 'https://hs.example/register/abc' },
    });
    render(<LobsterPage />);
    const link = await screen.findByRole('link', { name: 'https://hs.example/register/abc' });
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('button', { name: /Stop Node/ })).toBeEnabled();
  });

  test('ignores non-http auth URLs', async () => {
    lobsterApi.getStatus.mockResolvedValue({
      data: { status: 'needs_login', configured: true, online: false, auth_url: 'javascript:alert(1)' },
    });
    render(<LobsterPage />);
    await screen.findByRole('button', { name: /Stop Node/ });
    expect(screen.queryByRole('link')).toBeNull();
  });

  test('running: shows tailnet IP, peers, and pairing connect URL', async () => {
    lobsterApi.getStatus.mockResolvedValue({
      data: { status: 'running', configured: true, online: true, hostname: 'watchnexus-box', tailnet_ip: '100.64.0.1' },
    });
    lobsterApi.getPeers.mockResolvedValue({ data: [{ name: 'phone', tailnet_ip: '100.64.0.2', online: true }] });
    lobsterApi.pair.mockResolvedValue({
      data: { status: 'running', connect_url: 'http://100.64.0.1/', message: 'Devices already on this mesh can open WatchNexus' },
    });
    render(<LobsterPage />);
    await screen.findByText('100.64.0.1');
    expect(screen.getByText('phone')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Pair a Device/ }));
    await waitFor(() => expect(screen.getByText('http://100.64.0.1/')).toBeInTheDocument());
  });
});
