import { render, screen, waitFor } from '@testing-library/react';

jest.mock('axios', () => ({
  get: jest.fn(),
  defaults: {},
}));

import axios from 'axios';
import { LicenseProvider, useLicense, ROUTE_MODULE_MAP } from '../context/LicenseContext';

const Probe = () => {
  const { tier, loading, isModuleUnlocked, isRouteUnlocked } = useLicense();
  if (loading) return <div data-testid="license-loading">loading</div>;
  return (
    <div>
      <div data-testid="tier">{tier}</div>
      <div data-testid="mod-standard">{String(isModuleUnlocked('marmalade'))}</div>
      <div data-testid="mod-pro">{String(isModuleUnlocked('compote'))}</div>
      <div data-testid="mod-ultra">{String(isModuleUnlocked('security'))}</div>
      <div data-testid="route-indexers">{String(isRouteUnlocked('/indexers'))}</div>
    </div>
  );
};

describe('LicenseContext (cookie-auth tier gating)', () => {
  afterEach(() => jest.clearAllMocks());

  test('fetches /api/cellar/status without any localStorage token gating', async () => {
    axios.get.mockResolvedValueOnce({ data: { tier: 'pro', modules_unlocked: [] } });
    render(<LicenseProvider><Probe /></LicenseProvider>);
    await waitFor(() => expect(screen.getByTestId('tier')).toHaveTextContent('pro'));
    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/api/cellar/status'));
  });

  test('pro tier unlocks standard+pro modules but not ultra', async () => {
    axios.get.mockResolvedValueOnce({ data: { tier: 'pro', modules_unlocked: [] } });
    render(<LicenseProvider><Probe /></LicenseProvider>);
    await waitFor(() => expect(screen.getByTestId('tier')).toHaveTextContent('pro'));
    expect(screen.getByTestId('mod-standard')).toHaveTextContent('true');
    expect(screen.getByTestId('mod-pro')).toHaveTextContent('true');
    expect(screen.getByTestId('mod-ultra')).toHaveTextContent('false');
    expect(screen.getByTestId('route-indexers')).toHaveTextContent('true');
  });

  test('falls back to standard tier when the status call fails', async () => {
    axios.get.mockRejectedValueOnce(new Error('401'));
    render(<LicenseProvider><Probe /></LicenseProvider>);
    await waitFor(() => expect(screen.getByTestId('tier')).toHaveTextContent('standard'));
    expect(screen.getByTestId('mod-pro')).toHaveTextContent('false');
  });

  test('every mapped route resolves to a module string', () => {
    Object.values(ROUTE_MODULE_MAP).forEach((mod) => {
      expect(typeof mod).toBe('string');
      expect(mod.length).toBeGreaterThan(0);
    });
  });
});
